import { Extension } from 'cbor-x/decode';
import { Encoder, addExtension } from 'https://cdn.skypack.dev/cbor-x?dts';

export class TypedCborStruct {
  data: object;
  types: object;

  constructor(data, types: object = {}) {
    this.data = data;
    this.types = types;
  }

  static encode(instance, cborXEncoder, makeRoom) {
    let position = 0;
    let start = 0;
    const target = makeRoom(8192);
    target[position++] = 0xb9;
    let objectOffset = position - start;
    position += 2;
    let size = 0;
    for (let key in instance.data) {
      cborXEncoder(key);
      cborXEncoder(instance.data[key]);
      size++;
    }
    target[objectOffset++ + start] = size >> 8;
    target[objectOffset + start] = size & 255;
    // cborXEncoder(instance.data);
  }
}

addExtension({
  Class: TypedCborStruct,
  encode: TypedCborStruct.encode as (value: any) => Buffer,
} as unknown as Extension);

export const cborEncoder = new Encoder({
  useRecords: false,
});
