import admin from "../utils/firebase.js";
//@ts-ignore
export async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    // Attach user info to context for downstream routes
    c.set("user", decodedToken);
    return next();
  } catch (err) {
    return c.json({ error: "Invalid token" }, 401);
  }
}