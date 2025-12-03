import { useEffect, useState } from "react";
import api from "../utils/api";

export default function Home() {
  const [user, setUser] = useState(null);

  const fetchUserData = async () => {
    try {
      const response = await api.get("/user");
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };
  useEffect(() => {
    fetchUserData();
  }, []);

  return <div>Home {user && <pre>{JSON.stringify(user, null, 2)}</pre>} </div>;
}
