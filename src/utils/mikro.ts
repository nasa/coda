import {
  Connection,
  EntityManager,
  IDatabaseDriver,
  MikroORM,
  RequestContext,
} from "@mikro-orm/core";
import config from "../../mikro-orm.config";
import { globalValues } from "../server/express/global";

export const getORM = async (): Promise<MikroORM<IDatabaseDriver<Connection>>> => {
  if (!globalValues.ormCache) {
    globalValues.ormCache = await MikroORM.init(config);
  }
  return globalValues.ormCache;
};

export const getEM = (): EntityManager<IDatabaseDriver<Connection>> => {
  let em = RequestContext.getEntityManager();
  if (!globalValues.ormCache) {
    throw new Error("Run Mikro.getORM() first");
  }
  if (!em) {
    em = globalValues.ormCache.em.fork();
    if (!em) {
      throw new Error("Entity Manager not initialized");
    }
  }
  return em;
};

export const closeORM = async (): Promise<void> => {
  if (globalValues.ormCache) {
    await globalValues.ormCache.close();
    globalValues.ormCache = null;
  }
};
