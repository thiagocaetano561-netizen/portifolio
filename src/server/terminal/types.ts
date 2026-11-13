import "server-only";
import type { Db } from "../db/client";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
