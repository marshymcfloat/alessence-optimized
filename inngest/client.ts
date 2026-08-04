import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "alessence",
  isDev: process.env.INNGEST_DEV === "1",
  schemas: undefined,
});
