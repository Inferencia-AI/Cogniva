import admin from "firebase-admin";

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: required("FIREBASE_PROJECT_ID"),
    private_key_id: required("FIREBASE_PRIVATE_KEY_ID"),
    private_key: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    client_email: required("FIREBASE_CLIENT_EMAIL"),
    client_id: required("FIREBASE_CLIENT_ID"),
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: required("FIREBASE_CLIENT_X509_CERT_URL"),
    universe_domain: "googleapis.com",
  } as admin.ServiceAccount),
});

export default admin;