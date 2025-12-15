import { addExtension, Encoder } from './lib/cbor-x/encode.js';
import { Decoder } from './lib/cbor-x/decode.js';
import { Extension } from './lib/cbor-x/decode.js';
// import { Encoder, addExtension } from 'https://cdn.skypack.dev/cbor-x?dts';

class TypedFloat64 {
  value: number;
  constructor(value: number) {
    this.value = value;
  }

  static encode(instance: ProxiedTypedFloat64) {
    const self = this as unknown as Encoder;
    self.target[self.position++] = 0xfb;
    self.targetView.setFloat64(self.position, instance.value);
    self.position += 8;
  }
}

export type ProxiedTypedFloat64 = TypedFloat64 & number;

/**
 * Make a TypedFloat64 instance with properties and methods proxied from the internal number.
 */
export const makeFloat64 = (value: number): ProxiedTypedFloat64 =>
  new Proxy(new TypedFloat64(value), {
    get(target, prop, receiver) {
      if (prop === 'value') {
        return target.value;
      }
      const number = target.value;
      const value = number[prop];
      return typeof value === 'function' ? value.bind(number) : value;
    },
  }) as ProxiedTypedFloat64;

addExtension({
  Class: TypedFloat64,
  encode: TypedFloat64.encode,
});

class TypedUint {
  value: number;
  constructor(value: number) {
    this.value = value;
  }

  static encode(instance: ProxiedTypedUint) {
    const self = this as unknown as Encoder;
    const value = instance.value;
    if (value >>> 0 !== value) {
      throw new Error('Value is not an unsigned integer');
    }
    if (value < 0x18) {
      self.target[self.position++] = value;
    } else if (value < 0x100) {
      self.target[self.position++] = 0x18;
      self.target[self.position++] = value;
    } else if (value < 0x10000) {
      self.target[self.position++] = 0x19;
      self.target[self.position++] = value >> 8;
      self.target[self.position++] = value & 0xff;
    } else {
      self.target[self.position++] = 0x1a;
      self.targetView.setUint32(self.position, value);
      self.position += 4;
    }
  }
}

export type ProxiedTypedUint = TypedUint & number;

export const makeUint = (value: number): ProxiedTypedUint =>
  new Proxy(new TypedUint(value), {
    get(target, prop, receiver) {
      if (prop === 'value') {
        return target.value;
      }
      const number = target.value;
      const value = number[prop];
      return typeof value === 'function' ? value.bind(number) : value;
    },
  }) as ProxiedTypedUint;

addExtension({
  Class: TypedUint,
  encode: TypedUint.encode,
});

export const cborEncoder = new Encoder({
  useRecords: false,
});

export const cborDecoder = new Decoder({
  useRecords: false,
});

// class TypedSint {
//   value: number;
//   constructor(value: number) {
//     this.value = value;
//   }

//   static encode(instance: ProxiedTypedSint) {
//     const self = this as unknown as Encoder;
//     const value = instance.value;
//     if (value >>> 0 !== value) {
//       throw new Error('Value is not a signed integer');
//     }
//     if (value < 0x20) {
//       self.target[self.position++] = value;
//     } else if (value < 0x100) {
//       self.target[self.position++] = 0x20;
//       self.target[self.position++] = value;
//     } else if (value < 0x10000) {
//       self.target[self.position++] = 0x21;
//       self.target[self.position++] = value >> 8;
//       self.target[self.position++] = value & 0xff;
//     } else {
//       self.target[self.position++] = 0x22;
//       self.targetView.setInt32(self.position, value);
//       self.position += 4;
//     }
//   }
// }

// export type ProxiedTypedSint = TypedSint & number;

// const testObj = {
//   a: 69,
//   b: 1.5,
//   c: 2.5,
// };

// const typedTestObj = {
//   a: makeFloat64(69),
//   b: makeFloat64(1.5),
//   c: makeFloat64(2.5),
// };

// const baseEncoded = cborEncoder.encode(testObj);
// const typedEncoded = cborEncoder.encode(typedTestObj);

// console.log(baseEncoded, decode(baseEncoded));
// console.log(baseEncoded, decode(typedEncoded));
