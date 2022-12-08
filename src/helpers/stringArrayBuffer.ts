export function ab2str(buf: any) {
  return String.fromCharCode.apply(null, new Uint8Array(buf) as any);
}
export function str2ab(str: string) {
  var buf = new ArrayBuffer(str.length);
  var bufView = new Uint8Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++)
    bufView[i] = str.charCodeAt(i);
  return buf;
}
