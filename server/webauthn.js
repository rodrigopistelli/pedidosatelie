// Login com biometria / PIN / facial do dispositivo (WebAuthn / passkeys).
// Fluxo: usuário loga 1x com senha -> cadastra o dispositivo em "Dispositivos" ->
// depois entra só com a biometria, sem senha.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

function rpConfig() {
  const front = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (front) {
    const u = new URL(front);
    return { rpID: u.hostname, origin: u.origin };
  }
  // Dev local (Vite): contexto seguro em http://localhost
  return { rpID: "localhost", origin: "http://localhost:5173" };
}

// Desafios pendentes (instância única — ok no plano free com 1 instância)
const challenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function guardar(chave, challenge) {
  challenges.set(chave, { challenge, expira: Date.now() + CHALLENGE_TTL_MS });
}

function consumir(chave) {
  const item = challenges.get(chave);
  challenges.delete(chave);
  if (!item || item.expira < Date.now()) return null;
  return item.challenge;
}

function userIDBytes(id) {
  return new TextEncoder().encode(`pedidosatelie-u${id}`);
}

export function webauthnRoutes({ app, auth, ah, all, get, run, insert, jwt, JWT_SECRET }) {
  const { rpID, origin } = rpConfig();
  console.log(`WebAuthn: rpID=${rpID} origin=${origin}`);

  // ---- Cadastro de dispositivo (logado) ----
  app.get("/api/webauthn/register/options", auth, ah(async (req, res) => {
    const creds = await all("SELECT id, transports FROM webauthn_credentials WHERE user_id = ?", [req.user.id]);
    const options = await generateRegistrationOptions({
      rpName: "PedidosAtelie",
      rpID,
      userName: req.user.username,
      userID: userIDBytes(req.user.id),
      attestationType: "none",
      excludeCredentials: creds.map((c) => ({
        id: c.id,
        transports: JSON.parse(c.transports || "[]"),
      })),
      authenticatorSelection: {
        // Biometria / PIN / facial do próprio aparelho
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
    });
    guardar(`reg:${req.user.id}`, options.challenge);
    res.json(options);
  }));

  app.post("/api/webauthn/register/verify", auth, ah(async (req, res) => {
    const { attestation, nome = "" } = req.body || {};
    if (!attestation?.id) return res.status(400).json({ error: "Resposta inválida" });
    const expectedChallenge = consumir(`reg:${req.user.id}`);
    if (!expectedChallenge)
      return res.status(400).json({ error: "Sessão expirada — gere as opções novamente" });
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: attestation,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      return res.status(400).json({ error: "Falha ao verificar o dispositivo" });
    }
    if (!verification.verified || !verification.registrationInfo)
      return res.status(400).json({ error: "Registro não verificado" });
    const { credential } = verification.registrationInfo;
    try {
      await run(
        "INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports, nome) VALUES (?, ?, ?, ?, ?, ?)",
        [
          credential.id,
          req.user.id,
          isoBase64URL.fromBuffer(credential.publicKey),
          credential.counter,
          JSON.stringify(credential.transports || []),
          String(nome).trim().slice(0, 60),
        ]
      );
    } catch (e) {
      if (String(e.message).includes("UNIQUE") || String(e.message).includes("duplicate"))
        return res.status(409).json({ error: "Este dispositivo já está cadastrado" });
      throw e;
    }
    res.status(201).json({ ok: true, id: credential.id });
  }));

  app.get("/api/webauthn/devices", auth, ah(async (req, res) => {
    const rows = await all(
      "SELECT id, nome, created_at FROM webauthn_credentials WHERE user_id = ? ORDER BY id",
      [req.user.id]
    );
    res.json(rows);
  }));

  app.delete("/api/webauthn/devices/:id", auth, ah(async (req, res) => {
    await run("DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?", [
      String(req.params.id),
      req.user.id,
    ]);
    res.json({ ok: true });
  }));

  // ---- Login com biometria (público, com username) ----
  app.get("/api/webauthn/login/options", ah(async (req, res) => {
    const username = String(req.query.username || "").trim();
    if (!username) return res.status(400).json({ error: "Informe o usuário" });
    const user = await get("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) return res.status(401).json({ error: "Usuário ou biometria inválidos" });
    const creds = await all("SELECT id, transports FROM webauthn_credentials WHERE user_id = ?", [user.id]);
    if (!creds.length)
      return res.status(400).json({ error: "Nenhum dispositivo cadastrado — entre com a senha primeiro" });
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: creds.map((c) => ({
        id: c.id,
        transports: JSON.parse(c.transports || "[]"),
      })),
      userVerification: "required",
    });
    guardar(`auth:${username}`, options.challenge);
    res.json(options);
  }));

  app.post("/api/webauthn/login/verify", ah(async (req, res) => {
    const { username, assertion } = req.body || {};
    const name = String(username || "").trim();
    if (!name || !assertion?.id)
      return res.status(400).json({ error: "Dados inválidos" });
    const user = await get("SELECT * FROM users WHERE username = ?", [name]);
    if (!user) return res.status(401).json({ error: "Usuário ou biometria inválidos" });
    const cred = await get("SELECT * FROM webauthn_credentials WHERE id = ? AND user_id = ?", [
      String(assertion.id),
      user.id,
    ]);
    if (!cred) return res.status(401).json({ error: "Dispositivo não reconhecido" });
    const expectedChallenge = consumir(`auth:${name}`);
    if (!expectedChallenge)
      return res.status(400).json({ error: "Sessão expirada — tente novamente" });
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.id,
          publicKey: isoBase64URL.toBuffer(cred.public_key),
          counter: Number(cred.counter),
          transports: JSON.parse(cred.transports || "[]"),
        },
        requireUserVerification: true,
      });
    } catch {
      return res.status(401).json({ error: "Falha na verificação biométrica" });
    }
    if (!verification.verified)
      return res.status(401).json({ error: "Biometria não verificada" });
    await run("UPDATE webauthn_credentials SET counter = ? WHERE id = ?", [
      verification.authenticationInfo.newCounter,
      cred.id,
    ]);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ token, username: user.username });
  }));
}
