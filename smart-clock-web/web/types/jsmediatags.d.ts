declare module "jsmediatags" {
  type TagResult = {
    tags: {
      title?: string;
      artist?: string;
      album?: string;
    };
  };

  type ReadOptions = {
    onSuccess: (result: TagResult) => void;
    onError: (error: unknown) => void;
  };

  const jsmediatags: {
    read(file: File, options: ReadOptions): void;
  };

  export default jsmediatags;
}
