/** Variables que los middlewares dejan en el contexto de Hono. */
export type AppEnv = {
  Variables: {
    clientIp: string;
    userId: string;
    sessionId: string;
  };
};
