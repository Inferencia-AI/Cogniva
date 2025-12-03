import admin from "firebase-admin";
import serviceAccount from "../../cogniva-configs.json" with { type: "json" };
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
export default admin;