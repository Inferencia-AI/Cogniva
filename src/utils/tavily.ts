import { tavily } from "@tavily/core";

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

const tvly = tavily({ apiKey: required("TAVILY_API_KEY") });
export default tvly;