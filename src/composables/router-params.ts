function getStringFromParam(param: string | string[]): string {
  // A Vue router param can be a string or array of strings.
  if (Array.isArray(param)) {
    // This will likely never be the case
    return param[0];
  }
  return param;
}

export default {
  getStringFromParam,
};
