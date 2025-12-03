import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../utils/firebaseClient";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface signinProps {
  email: string,
  password: string
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const provider = new GoogleAuthProvider();

  const navigate = useNavigate()

  async function signIn({email, password}:signinProps) {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    // Get the ID token (JWT)
    const idToken = await user.getIdToken(/* forceRefresh = */ true);
    localStorage.setItem("token", idToken);
    return idToken;
  }
  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const idToken = await user.getIdToken();
    localStorage.setItem("token", idToken);
    return idToken;
  }
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in.
        console.log("User signed in: ", user);
        navigate("/home")
      } else {
        // User is signed out.
        console.log("User signed out");
      }
    });
    return () => unsubscribe();
  }, []);
  return (
    <div>
      <h1>Login Page</h1>
      <input type="text" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={() => signInWithGoogle()}>Google signin</button>
      <button onClick={() => signIn({ email, password })}>Login with email and password</button>
    </div>
  );
}
