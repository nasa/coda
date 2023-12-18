import _ from "lodash";

const cacache: any = jest.createMockFromModule("cacache");

const mockCache = {};

cacache.get = async function (cachePath: string, key: string): Promise<any> {
  return _.get(mockCache, [cachePath, key]);
};

cacache.get.info = async function (cachePath: string, key: string): Promise<any> {
  return _.get(mockCache, [cachePath, key], null);
};

cacache.put = async function (
  cachePath: string,
  key: string,
  data: any,
  opts?: { metadata: any },
): Promise<string> {
  _.set(mockCache, [cachePath, key], { data, ...opts });
  return Promise.resolve("fakedigest");
};

cacache.rm.all = async function () {
  return {
    all: (cachePath: string): Promise<boolean> => {
      delete mockCache[cachePath];
      return Promise.resolve(true);
    },
  };
};

export default cacache;
