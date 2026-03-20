export const create = () => {
  throw new Error("Plaid not supported on web");
};

export const open = () => {
  throw new Error("Plaid not supported on web");
};

export const destroy = async () => {};

export const LinkLogLevel = {
  ERROR: "ERROR",
} as const;

export type LinkExit = unknown;
export type LinkSuccess = { publicToken: string };
