namespace __proto {
  /**
   * Decoder implements protobuf message decode interface.
   *
   * Useful references:
   *
   * Protocol Buffer encoding: https://developers.google.com/protocol-buffers/docs/encoding
   * LEB128 encoding AKA varint 128 encoding: https://en.wikipedia.org/wiki/LEB128
   * ZigZag encoding/decoding (s32/s64): https://gist.github.com/mfuerstenau/ba870a29e16536fdbaba
   */
  export class Decoder {
    public view: DataView;
    public pos: i32;

    constructor(view: DataView) {
      this.view = view;
      this.pos = 0;
    }

    /**
     * Returns true if current reader has reached the buffer end
     * @returns True if current reader has reached the buffer end
     */
    @inline
    eof(): bool {
      return this.pos >= this.view.byteLength;
    }

    /**
     * Returns current buffer length in bytes
     * @returns Length in bytes
     */
    @inline
    get byteLength(): i32 {
      return this.view.byteLength;
    }

    /**
     * An alias method to fetch tag from the reader. Supposed to return tuple of [field number, wire_type].
     * TODO: Replace with return tuple when tuples become implemented in AS.
     * @returns Message tag value
     */
    @inline
    tag(): u32 {
      return this.uint32();
    }

    /**
     * Returns byte at offset, alias for getUint8
     * @param byteOffset Offset
     * @returns u8
     */
    @inline
    private u8at(byteOffset: i32): u8 {
      return this.view.getUint8(byteOffset);
    }

    /**
     * Reads and returns varint number (128 + 10 bits max) from a current position.
     * @returns Returns varint
     */
    varint(): u64 {
      let value: u64;

      // u32
      value = (u64(u8(this.u8at(this.pos))) & 127) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 7)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 14)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 21)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      // u32 remainder or u64 byte
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 28)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      // u64
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 35)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value =
        (value | ((u64(u8(this.u8at(this.pos))) & 127) << 42)) /* 42!!! */ >>>
        0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 49)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 28)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      // u64 remainder
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 35)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;

      if (this.pos > this.byteLength) {
        this.throwOutOfRange();
      }

      return value;
    }

    @inline
    int32(): i32 {
      return i32(this.varint());
    }

    @inline
    int64(): i64 {
      return i32(this.varint());
    }

    @inline
    uint32(): u32 {
      return u32(this.varint());
    }

    @inline
    uint64(): u64 {
      return u64(this.varint());
    }

    @inline
    sint32(): i32 {
      const n: u64 = this.varint();
      return i32((n >>> 1) ^ -(n & 1));
    }

    @inline
    sint64(): i64 {
      const n: u64 = this.varint();
      return i64((n >>> 1) ^ -(n & 1));
    }

    fixed32(): u32 {
      this.pos += 4;
      if (this.pos > this.byteLength) {
        this.throwOutOfRange();
      }

      // u32(u8) ensures that u8(-1) becomes u32(4294967295) instead of u8(255)
      return (
        u32(u8(this.u8at(this.pos - 4))) |
        (u32(u8(this.u8at(this.pos - 3))) << 8) |
        (u32(u8(this.u8at(this.pos - 2))) << 16) |
        (u32(u8(this.u8at(this.pos - 1))) << 24)
      );
    }

    @inline
    sfixed32(): i32 {
      return i32(this.fixed32());
    }

    fixed64(): u64 {
      this.pos += 8;
      if (this.pos > this.byteLength) {
        this.throwOutOfRange();
      }

      return (
        u64(u8(this.u8at(this.pos - 8))) |
        (u64(u8(this.u8at(this.pos - 7))) << 8) |
        (u64(u8(this.u8at(this.pos - 6))) << 16) |
        (u64(u8(this.u8at(this.pos - 5))) << 24) |
        (u64(u8(this.u8at(this.pos - 4))) << 32) |
        (u64(u8(this.u8at(this.pos - 3))) << 40) |
        (u64(u8(this.u8at(this.pos - 2))) << 48) |
        (u64(u8(this.u8at(this.pos - 1))) << 56)
      );
    }

    @inline
    sfixed64(): i64 {
      return i64(this.fixed64());
    }

    @inline
    float(): f32 {
      return f32.reinterpret_i32(this.fixed32());
    }

    @inline
    double(): f64 {
      return f64.reinterpret_i64(this.fixed64());
    }

    @inline
    bool(): boolean {
      return this.uint32() > 0;
    }

    /**
     * Reads and returns UTF8 string.
     * @returns String
     */
    string(): string {
      const length = this.uint32();
      if (this.pos + length > this.byteLength) {
        this.throwOutOfRange();
      }

      const p = this.pos + this.view.byteOffset;
      const value = String.UTF8.decode(this.view.buffer.slice(p, p + length));
      this.pos += length;
      return value;
    }

    /**
     * Reads and returns bytes array.
     * @returns Array<u8> of bytes
     */
    bytes(): Array<u8> {
      const len = this.uint32();
      if (this.pos + len > this.byteLength) {
        this.throwOutOfRange();
      }

      const a = new Array<u8>(len);
      for (let i: u32 = 0; i < len; i++) {
        a[i] = u8(this.u8at(this.pos++));
      }

      return a;
    }

    /**
     * Skips a message field if it can'be recognized by an object's decode() method
     * @param wireType Current wire type
     */
    skipType(wireType: u32): void {
      switch (wireType) {
        // int32, int64, uint32, uint64, sint32, sint64, bool, enum: varint, variable length
        case 0:
          this.varint(); // Just read a varint
          break;
        // fixed64, sfixed64, double: 8 bytes always
        case 1:
          this.skip(8);
          break;
        // length-delimited; length is determined by varint32; skip length bytes;
        case 2:
          this.skip(this.uint32());
          break;
        // tart group: skip till the end of the group, then skip group end marker
        case 3:
          while ((wireType = this.uint32() & 7) !== 4) {
            this.skipType(wireType);
          }
          break;
        // fixed32, sfixed32, float: 4 bytes always
        case 5:
          this.skip(4);
          break;

        // Something went beyond our capability to understand
        default:
          throw new Error(
            `Invalid wire type ${wireType} at offset ${this.pos}`
          );
      }
    }

    /**
     * Fast-forwards cursor by length with boundary check
     * @param length Byte length
     */
    skip(length: u32): void {
      if (this.pos + length > this.byteLength) {
        this.throwOutOfRange();
      }
      this.pos += length;
    }

    /**
     * OutOfRange check. Throws an exception if current position exceeds current buffer range
     */
    @inline
    private throwOutOfRange(): void {
      throw new Error(`Decoder position ${this.pos} is out of range!`);
    }
  }

  /**
   * Encoder implements protobuf message encode interface. This is the simplest not very effective version, which uses
   * Array<u8>.
   *
   * Useful references:
   *
   * Protocol Buffer encoding: https://developers.google.com/protocol-buffers/docs/encoding
   * LEB128 encoding AKA varint 128 encoding: https://en.wikipedia.org/wiki/LEB128
   * ZigZag encoding/decoding (s32/s64): https://gist.github.com/mfuerstenau/ba870a29e16536fdbaba
   */
  export class Encoder {
    public buf: Array<u8>;

    constructor(buf: Array<u8>) {
      this.buf = buf;
    }

    /**
     * Encodes varint at a current position
     * @returns Returns varint
     */
    varint64(value: u64): void {
      let v: u64 = value;

      while (v > 127) {
        this.buf.push(u8((v & 127) | 128));
        v = v >> 7;
      }

      this.buf.push(u8(v));
    }

    @inline
    int32(value: i32): void {
      this.varint64(value);
    }

    @inline
    int64(value: i64): void {
      this.varint64(value);
    }

    @inline
    uint32(value: u32): void {
      this.varint64(value);
    }

    @inline
    uint64(value: u64): void {
      this.varint64(value);
    }

    @inline
    sint32(value: i32): void {
      this.varint64((value << 1) ^ (value >> 31));
    }

    @inline
    sint64(value: i64): void {
      this.varint64((value << 1) ^ (value >> 63));
    }

    @inline
    fixed32(value: u32): void {
      this.buf.push(u8(value & 255));
      this.buf.push(u8((value >> 8) & 255));
      this.buf.push(u8((value >> 16) & 255));
      this.buf.push(u8(value >> 24));
    }

    @inline
    sfixed32(value: i32): void {
      this.fixed32(u32(value));
    }

    @inline
    fixed64(value: u64): void {
      this.buf.push(u8(value & 255));
      this.buf.push(u8((value >> 8) & 255));
      this.buf.push(u8((value >> 16) & 255));
      this.buf.push(u8((value >> 24) & 255));
      this.buf.push(u8((value >> 32) & 255));
      this.buf.push(u8((value >> 40) & 255));
      this.buf.push(u8((value >> 48) & 255));
      this.buf.push(u8(value >> 56));
    }

    @inline
    sfixed64(value: i64): void {
      this.fixed64(u64(value));
    }

    @inline
    float(value: f32): void {
      this.fixed32(u32(i32.reinterpret_f32(value)));
    }

    @inline
    double(value: f64): void {
      this.fixed64(u64(i64.reinterpret_f64(value)));
    }

    @inline
    bool(value: boolean): void {
      this.buf.push(value ? 1 : 0);
    }

    string(value: string): void {
      const utf8string = new DataView(String.UTF8.encode(value));

      for (let i = 0; i < utf8string.byteLength; i++) {
        this.buf.push(utf8string.getUint8(i));
      }
    }

    @inline
    bytes(value: Array<u8>): void {
      for (let i = 0; i < value.length; i++) {
        this.buf.push(value[i]);
      }
    }
  }

  /**
   * Returns byte size required to encode a value of a certain type
   */
  export class Sizer {
    static varint64(value: u64): u32 {
      return value < 128
        ? 1 // 2^7
        : value < 16384
        ? 2 // 2^14
        : value < 2097152
        ? 3 // 2^21
        : value < 268435456
        ? 4 // 2^28
        : value < 34359738368
        ? 5 // 2^35
        : value < 4398046511104
        ? 6 // 2^42
        : value < 562949953421312
        ? 7 // 2^49
        : value < 72057594037927936
        ? 8 // 2^56
        : value < 9223372036854775808
        ? 9 // 2^63
        : 10;
    }

    @inline
    static int32(value: i32): u32 {
      return Sizer.varint64(u64(value));
    }

    @inline
    static int64(value: i64): u32 {
      return Sizer.varint64(u64(value));
    }

    @inline
    static uint32(value: u32): u32 {
      return Sizer.varint64(value);
    }

    @inline
    static uint64(value: u64): u32 {
      return Sizer.varint64(value);
    }

    @inline
    static sint32(value: i32): u32 {
      return Sizer.varint64((value << 1) ^ (value >> 31));
    }

    @inline
    static sint64(value: i64): u32 {
      return Sizer.varint64((value << 1) ^ (value >> 63));
    }

    @inline
    static string(value: string): u32 {
      return value.length;
    }

    @inline
    static bytes(value: Array<u8>): u32 {
      return value.length;
    }
  }
}
export namespace google {
  export namespace protobuf {
    /**
     * `Any` contains an arbitrary serialized protocol buffer message along with a
     *  URL that describes the type of the serialized message.
     *
     *  Protobuf library provides support to pack/unpack Any values in the form
     *  of utility functions or additional generated methods of the Any type.
     *
     *  Example 1: Pack and unpack a message in C++.
     *
     *      Foo foo = ...;
     *      Any any;
     *      any.PackFrom(foo);
     *      ...
     *      if (any.UnpackTo(&foo)) {
     *        ...
     *      }
     *
     *  Example 2: Pack and unpack a message in Java.
     *
     *      Foo foo = ...;
     *      Any any = Any.pack(foo);
     *      ...
     *      if (any.is(Foo.class)) {
     *        foo = any.unpack(Foo.class);
     *      }
     *      // or ...
     *      if (any.isSameTypeAs(Foo.getDefaultInstance())) {
     *        foo = any.unpack(Foo.getDefaultInstance());
     *      }
     *
     *   Example 3: Pack and unpack a message in Python.
     *
     *      foo = Foo(...)
     *      any = Any()
     *      any.Pack(foo)
     *      ...
     *      if any.Is(Foo.DESCRIPTOR):
     *        any.Unpack(foo)
     *        ...
     *
     *   Example 4: Pack and unpack a message in Go
     *
     *       foo := &pb.Foo{...}
     *       any, err := anypb.New(foo)
     *       if err != nil {
     *         ...
     *       }
     *       ...
     *       foo := &pb.Foo{}
     *       if err := any.UnmarshalTo(foo); err != nil {
     *         ...
     *       }
     *
     *  The pack methods provided by protobuf library will by default use
     *  'type.googleapis.com/full.type.name' as the type URL and the unpack
     *  methods only use the fully qualified type name after the last '/'
     *  in the type URL, for example "foo.bar.com/x/y.z" will yield type
     *  name "y.z".
     *
     *  JSON
     *  ====
     *  The JSON representation of an `Any` value uses the regular
     *  representation of the deserialized, embedded message, with an
     *  additional field `@type` which contains the type URL. Example:
     *
     *      package google.profile;
     *      message Person {
     *        string first_name = 1;
     *        string last_name = 2;
     *      }
     *
     *      {
     *        "@type": "type.googleapis.com/google.profile.Person",
     *        "firstName": <string>,
     *        "lastName": <string>
     *      }
     *
     *  If the embedded message type is well-known and has a custom JSON
     *  representation, that representation will be embedded adding a field
     *  `value` which holds the custom JSON in addition to the `@type`
     *  field. Example (for message [google.protobuf.Duration][]):
     *
     *      {
     *        "@type": "type.googleapis.com/google.protobuf.Duration",
     *        "value": "1.212s"
     *      }
     */
    export class Any {
      /**
       * A URL/resource name that uniquely identifies the type of the serialized
       *  protocol buffer message. This string must contain at least
       *  one "/" character. The last segment of the URL's path must represent
       *  the fully qualified name of the type (as in
       *  `path/google.protobuf.Duration`). The name should be in a canonical form
       *  (e.g., leading "." is not accepted).
       *
       *  In practice, teams usually precompile into the binary all types that they
       *  expect it to use in the context of Any. However, for URLs which use the
       *  scheme `http`, `https`, or no scheme, one can optionally set up a type
       *  server that maps type URLs to message definitions as follows:
       *
       *  * If no scheme is provided, `https` is assumed.
       *  * An HTTP GET on the URL must yield a [google.protobuf.Type][]
       *    value in binary format, or produce an error.
       *  * Applications are allowed to cache lookup results based on the
       *    URL, or have them precompiled into a binary to avoid any
       *    lookup. Therefore, binary compatibility needs to be preserved
       *    on changes to types. (Use versioned type names to manage
       *    breaking changes.)
       *
       *  Note: this functionality is not currently available in the official
       *  protobuf release, and it is not used for type URLs beginning with
       *  type.googleapis.com. As of May 2023, there are no widely used type server
       *  implementations and no plans to implement one.
       *
       *  Schemes other than `http`, `https` (or the empty scheme) might be
       *  used with implementation specific semantics.
       */
      public type_url: string = "";
      // Must be a valid serialized protocol buffer of the above specified type.
      public value: Array<u8> = new Array<u8>();

      // Decodes Any from an ArrayBuffer
      static decode(buf: ArrayBuffer): Any {
        return Any.decodeDataView(new DataView(buf));
      }

      // Decodes Any from a DataView
      static decodeDataView(view: DataView): Any {
        const decoder = new __proto.Decoder(view);
        const obj = new Any();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.type_url = decoder.string();
              break;
            }
            case 2: {
              obj.value = decoder.bytes();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Any

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.type_url.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.type_url.length) +
              this.type_url.length
            : 0;
        size +=
          this.value.length > 0
            ? 1 + __proto.Sizer.varint64(this.value.length) + this.value.length
            : 0;

        return size;
      }

      // Encodes Any to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Any to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.type_url.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.type_url.length);
          encoder.string(this.type_url);
        }
        if (this.value.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.value.length);
          encoder.bytes(this.value);
        }

        return buf;
      } // encode Any
    } // Any
  } // protobuf
} // google
export namespace edgeandnode {
  export namespace uniswap {
    export namespace v1 {
      export enum EventType {
        // Factory
        POOL_CREATED = 0,
        // Position Manager
        INCREASE_LIQUIDITY = 1,
        DECREASE_LIQUIDITY = 2,
        COLLECT = 3,
        TRANSFER = 4,
        // Pool
        INITIALIZE = 5,
        SWAP = 6,
        MINT = 7,
        BURN = 8,
        FLASH = 9,
      } // EventType
      export class Events {
        public events: Array<Event> = new Array<Event>();

        // Decodes Events from an ArrayBuffer
        static decode(buf: ArrayBuffer): Events {
          return Events.decodeDataView(new DataView(buf));
        }

        // Decodes Events from a DataView
        static decodeDataView(view: DataView): Events {
          const decoder = new __proto.Decoder(view);
          const obj = new Events();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const length = decoder.uint32();
                obj.events.push(
                  Event.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  )
                );
                decoder.skip(length);

                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Events

        public size(): u32 {
          let size: u32 = 0;

          for (let n: i32 = 0; n < this.events.length; n++) {
            const messageSize = this.events[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes Events to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Events to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          for (let n: i32 = 0; n < this.events.length; n++) {
            const messageSize = this.events[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xa);
              encoder.uint32(messageSize);
              this.events[n].encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode Events
      } // Events

      // Every address is stored as hex string.
      export class Event {
        /**
         * Owner points to the address that originated this event
         *  The PoolCreated will set this to factory, which is what we can use
         *  to track different factories with compatible events.
         */
        public owner: string = "";
        public type: u32;
        public event: google.protobuf.Any = new google.protobuf.Any();
        public address: string = "";
        public tx_hash: Array<u8> = new Array<u8>();
        public tx_gas_used: string = "";
        public tx_gas_price: Array<u8> = new Array<u8>();
        /**
         * This duplicates data (as opposed to adding this data to the head) but AssemblyScript does
         *  not support closures and so using the data is not super easy if it's in the header so I'll
         *  leave it here.
         */
        public block_number: i32;
        public block_timestamp: string = "";

        // Decodes Event from an ArrayBuffer
        static decode(buf: ArrayBuffer): Event {
          return Event.decodeDataView(new DataView(buf));
        }

        // Decodes Event from a DataView
        static decodeDataView(view: DataView): Event {
          const decoder = new __proto.Decoder(view);
          const obj = new Event();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.owner = decoder.string();
                break;
              }
              case 2: {
                obj.type = decoder.uint32();
                break;
              }
              case 3: {
                const length = decoder.uint32();
                obj.event = google.protobuf.Any.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 4: {
                obj.address = decoder.string();
                break;
              }
              case 5: {
                obj.tx_hash = decoder.bytes();
                break;
              }
              case 6: {
                obj.tx_gas_used = decoder.string();
                break;
              }
              case 7: {
                obj.tx_gas_price = decoder.bytes();
                break;
              }
              case 8: {
                obj.block_number = decoder.int32();
                break;
              }
              case 9: {
                obj.block_timestamp = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Event

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.owner.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.owner.length) +
                this.owner.length
              : 0;
          size += this.type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.type);

          if (this.event != null) {
            const f: google.protobuf.Any = this.event as google.protobuf.Any;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;
          size +=
            this.tx_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tx_hash.length) +
                this.tx_hash.length
              : 0;
          size +=
            this.tx_gas_used.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tx_gas_used.length) +
                this.tx_gas_used.length
              : 0;
          size +=
            this.tx_gas_price.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tx_gas_price.length) +
                this.tx_gas_price.length
              : 0;
          size +=
            this.block_number == 0
              ? 0
              : 1 + __proto.Sizer.int32(this.block_number);
          size +=
            this.block_timestamp.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.block_timestamp.length) +
                this.block_timestamp.length
              : 0;

          return size;
        }

        // Encodes Event to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Event to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.owner.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.owner.length);
            encoder.string(this.owner);
          }
          if (this.type != 0) {
            encoder.uint32(0x10);
            encoder.uint32(this.type);
          }

          if (this.event != null) {
            const f = this.event as google.protobuf.Any;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.address.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.address.length);
            encoder.string(this.address);
          }
          if (this.tx_hash.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.tx_hash.length);
            encoder.bytes(this.tx_hash);
          }
          if (this.tx_gas_used.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.tx_gas_used.length);
            encoder.string(this.tx_gas_used);
          }
          if (this.tx_gas_price.length > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(this.tx_gas_price.length);
            encoder.bytes(this.tx_gas_price);
          }
          if (this.block_number != 0) {
            encoder.uint32(0x40);
            encoder.int32(this.block_number);
          }
          if (this.block_timestamp.length > 0) {
            encoder.uint32(0x4a);
            encoder.uint32(this.block_timestamp.length);
            encoder.string(this.block_timestamp);
          }

          return buf;
        } // encode Event
      } // Event

      // Factory
      export class PoolCreated {
        public token0: string = "";
        public token1: string = "";
        public fee: string = "";
        public tick_spacing: string = "";
        public pool: string = "";

        // Decodes PoolCreated from an ArrayBuffer
        static decode(buf: ArrayBuffer): PoolCreated {
          return PoolCreated.decodeDataView(new DataView(buf));
        }

        // Decodes PoolCreated from a DataView
        static decodeDataView(view: DataView): PoolCreated {
          const decoder = new __proto.Decoder(view);
          const obj = new PoolCreated();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.token0 = decoder.string();
                break;
              }
              case 2: {
                obj.token1 = decoder.string();
                break;
              }
              case 3: {
                obj.fee = decoder.string();
                break;
              }
              case 4: {
                obj.tick_spacing = decoder.string();
                break;
              }
              case 5: {
                obj.pool = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode PoolCreated

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.token0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.token0.length) +
                this.token0.length
              : 0;
          size +=
            this.token1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.token1.length) +
                this.token1.length
              : 0;
          size +=
            this.fee.length > 0
              ? 1 + __proto.Sizer.varint64(this.fee.length) + this.fee.length
              : 0;
          size +=
            this.tick_spacing.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tick_spacing.length) +
                this.tick_spacing.length
              : 0;
          size +=
            this.pool.length > 0
              ? 1 + __proto.Sizer.varint64(this.pool.length) + this.pool.length
              : 0;

          return size;
        }

        // Encodes PoolCreated to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes PoolCreated to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.token0.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.token0.length);
            encoder.string(this.token0);
          }
          if (this.token1.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.token1.length);
            encoder.string(this.token1);
          }
          if (this.fee.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.fee.length);
            encoder.string(this.fee);
          }
          if (this.tick_spacing.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.tick_spacing.length);
            encoder.string(this.tick_spacing);
          }
          if (this.pool.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.pool.length);
            encoder.string(this.pool);
          }

          return buf;
        } // encode PoolCreated
      } // PoolCreated

      // Position Manager
      export class IncreaseLiquidity {
        public token_id: string = "";
        public liquidity: string = "";
        public amount0: string = "";
        public amount1: string = "";

        // Decodes IncreaseLiquidity from an ArrayBuffer
        static decode(buf: ArrayBuffer): IncreaseLiquidity {
          return IncreaseLiquidity.decodeDataView(new DataView(buf));
        }

        // Decodes IncreaseLiquidity from a DataView
        static decodeDataView(view: DataView): IncreaseLiquidity {
          const decoder = new __proto.Decoder(view);
          const obj = new IncreaseLiquidity();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.token_id = decoder.string();
                break;
              }
              case 2: {
                obj.liquidity = decoder.string();
                break;
              }
              case 3: {
                obj.amount0 = decoder.string();
                break;
              }
              case 4: {
                obj.amount1 = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode IncreaseLiquidity

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.token_id.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.token_id.length) +
                this.token_id.length
              : 0;
          size +=
            this.liquidity.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.liquidity.length) +
                this.liquidity.length
              : 0;
          size +=
            this.amount0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount0.length) +
                this.amount0.length
              : 0;
          size +=
            this.amount1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount1.length) +
                this.amount1.length
              : 0;

          return size;
        }

        // Encodes IncreaseLiquidity to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes IncreaseLiquidity to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.token_id.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.token_id.length);
            encoder.string(this.token_id);
          }
          if (this.liquidity.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.liquidity.length);
            encoder.string(this.liquidity);
          }
          if (this.amount0.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.amount0.length);
            encoder.string(this.amount0);
          }
          if (this.amount1.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.amount1.length);
            encoder.string(this.amount1);
          }

          return buf;
        } // encode IncreaseLiquidity
      } // IncreaseLiquidity

      export class DecreaseLiquidity {
        public token_id: string = "";
        public liquidity: string = "";
        public amount0: string = "";
        public amount1: string = "";

        // Decodes DecreaseLiquidity from an ArrayBuffer
        static decode(buf: ArrayBuffer): DecreaseLiquidity {
          return DecreaseLiquidity.decodeDataView(new DataView(buf));
        }

        // Decodes DecreaseLiquidity from a DataView
        static decodeDataView(view: DataView): DecreaseLiquidity {
          const decoder = new __proto.Decoder(view);
          const obj = new DecreaseLiquidity();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.token_id = decoder.string();
                break;
              }
              case 2: {
                obj.liquidity = decoder.string();
                break;
              }
              case 3: {
                obj.amount0 = decoder.string();
                break;
              }
              case 4: {
                obj.amount1 = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode DecreaseLiquidity

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.token_id.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.token_id.length) +
                this.token_id.length
              : 0;
          size +=
            this.liquidity.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.liquidity.length) +
                this.liquidity.length
              : 0;
          size +=
            this.amount0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount0.length) +
                this.amount0.length
              : 0;
          size +=
            this.amount1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount1.length) +
                this.amount1.length
              : 0;

          return size;
        }

        // Encodes DecreaseLiquidity to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes DecreaseLiquidity to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.token_id.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.token_id.length);
            encoder.string(this.token_id);
          }
          if (this.liquidity.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.liquidity.length);
            encoder.string(this.liquidity);
          }
          if (this.amount0.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.amount0.length);
            encoder.string(this.amount0);
          }
          if (this.amount1.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.amount1.length);
            encoder.string(this.amount1);
          }

          return buf;
        } // encode DecreaseLiquidity
      } // DecreaseLiquidity

      export class Collect {
        public token_id: string = "";
        public recipient: string = "";
        public amount0: string = "";
        public amount1: string = "";

        // Decodes Collect from an ArrayBuffer
        static decode(buf: ArrayBuffer): Collect {
          return Collect.decodeDataView(new DataView(buf));
        }

        // Decodes Collect from a DataView
        static decodeDataView(view: DataView): Collect {
          const decoder = new __proto.Decoder(view);
          const obj = new Collect();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.token_id = decoder.string();
                break;
              }
              case 2: {
                obj.recipient = decoder.string();
                break;
              }
              case 3: {
                obj.amount0 = decoder.string();
                break;
              }
              case 4: {
                obj.amount1 = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Collect

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.token_id.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.token_id.length) +
                this.token_id.length
              : 0;
          size +=
            this.recipient.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.recipient.length) +
                this.recipient.length
              : 0;
          size +=
            this.amount0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount0.length) +
                this.amount0.length
              : 0;
          size +=
            this.amount1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount1.length) +
                this.amount1.length
              : 0;

          return size;
        }

        // Encodes Collect to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Collect to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.token_id.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.token_id.length);
            encoder.string(this.token_id);
          }
          if (this.recipient.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.recipient.length);
            encoder.string(this.recipient);
          }
          if (this.amount0.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.amount0.length);
            encoder.string(this.amount0);
          }
          if (this.amount1.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.amount1.length);
            encoder.string(this.amount1);
          }

          return buf;
        } // encode Collect
      } // Collect

      export class Transfer {
        public from: string = "";
        public to: string = "";
        public token_id: string = "";

        // Decodes Transfer from an ArrayBuffer
        static decode(buf: ArrayBuffer): Transfer {
          return Transfer.decodeDataView(new DataView(buf));
        }

        // Decodes Transfer from a DataView
        static decodeDataView(view: DataView): Transfer {
          const decoder = new __proto.Decoder(view);
          const obj = new Transfer();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.from = decoder.string();
                break;
              }
              case 2: {
                obj.to = decoder.string();
                break;
              }
              case 3: {
                obj.token_id = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Transfer

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.from.length > 0
              ? 1 + __proto.Sizer.varint64(this.from.length) + this.from.length
              : 0;
          size +=
            this.to.length > 0
              ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
              : 0;
          size +=
            this.token_id.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.token_id.length) +
                this.token_id.length
              : 0;

          return size;
        }

        // Encodes Transfer to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Transfer to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.from.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.from.length);
            encoder.string(this.from);
          }
          if (this.to.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.to.length);
            encoder.string(this.to);
          }
          if (this.token_id.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.token_id.length);
            encoder.string(this.token_id);
          }

          return buf;
        } // encode Transfer
      } // Transfer

      // Pool
      export class Initialize {
        public sqrt_price_x96: string = "";
        public tick: string = "";

        // Decodes Initialize from an ArrayBuffer
        static decode(buf: ArrayBuffer): Initialize {
          return Initialize.decodeDataView(new DataView(buf));
        }

        // Decodes Initialize from a DataView
        static decodeDataView(view: DataView): Initialize {
          const decoder = new __proto.Decoder(view);
          const obj = new Initialize();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.sqrt_price_x96 = decoder.string();
                break;
              }
              case 2: {
                obj.tick = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Initialize

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.sqrt_price_x96.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.sqrt_price_x96.length) +
                this.sqrt_price_x96.length
              : 0;
          size +=
            this.tick.length > 0
              ? 1 + __proto.Sizer.varint64(this.tick.length) + this.tick.length
              : 0;

          return size;
        }

        // Encodes Initialize to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Initialize to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.sqrt_price_x96.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.sqrt_price_x96.length);
            encoder.string(this.sqrt_price_x96);
          }
          if (this.tick.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.tick.length);
            encoder.string(this.tick);
          }

          return buf;
        } // encode Initialize
      } // Initialize

      export class Swap {
        public sender: string = "";
        public recipient: string = "";
        public amount0: string = "";
        public amount1: string = "";
        public sqrt_price_x96: string = "";
        public liquidity: string = "";
        public tick: string = "";
        public log_index: i32;
        public transaction_from: string = "";

        // Decodes Swap from an ArrayBuffer
        static decode(buf: ArrayBuffer): Swap {
          return Swap.decodeDataView(new DataView(buf));
        }

        // Decodes Swap from a DataView
        static decodeDataView(view: DataView): Swap {
          const decoder = new __proto.Decoder(view);
          const obj = new Swap();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.sender = decoder.string();
                break;
              }
              case 2: {
                obj.recipient = decoder.string();
                break;
              }
              case 3: {
                obj.amount0 = decoder.string();
                break;
              }
              case 4: {
                obj.amount1 = decoder.string();
                break;
              }
              case 5: {
                obj.sqrt_price_x96 = decoder.string();
                break;
              }
              case 6: {
                obj.liquidity = decoder.string();
                break;
              }
              case 7: {
                obj.tick = decoder.string();
                break;
              }
              case 8: {
                obj.log_index = decoder.int32();
                break;
              }
              case 9: {
                obj.transaction_from = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Swap

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.sender.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.sender.length) +
                this.sender.length
              : 0;
          size +=
            this.recipient.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.recipient.length) +
                this.recipient.length
              : 0;
          size +=
            this.amount0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount0.length) +
                this.amount0.length
              : 0;
          size +=
            this.amount1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount1.length) +
                this.amount1.length
              : 0;
          size +=
            this.sqrt_price_x96.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.sqrt_price_x96.length) +
                this.sqrt_price_x96.length
              : 0;
          size +=
            this.liquidity.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.liquidity.length) +
                this.liquidity.length
              : 0;
          size +=
            this.tick.length > 0
              ? 1 + __proto.Sizer.varint64(this.tick.length) + this.tick.length
              : 0;
          size +=
            this.log_index == 0 ? 0 : 1 + __proto.Sizer.int32(this.log_index);
          size +=
            this.transaction_from.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.transaction_from.length) +
                this.transaction_from.length
              : 0;

          return size;
        }

        // Encodes Swap to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Swap to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.sender.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.sender.length);
            encoder.string(this.sender);
          }
          if (this.recipient.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.recipient.length);
            encoder.string(this.recipient);
          }
          if (this.amount0.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.amount0.length);
            encoder.string(this.amount0);
          }
          if (this.amount1.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.amount1.length);
            encoder.string(this.amount1);
          }
          if (this.sqrt_price_x96.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.sqrt_price_x96.length);
            encoder.string(this.sqrt_price_x96);
          }
          if (this.liquidity.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.liquidity.length);
            encoder.string(this.liquidity);
          }
          if (this.tick.length > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(this.tick.length);
            encoder.string(this.tick);
          }
          if (this.log_index != 0) {
            encoder.uint32(0x40);
            encoder.int32(this.log_index);
          }
          if (this.transaction_from.length > 0) {
            encoder.uint32(0x4a);
            encoder.uint32(this.transaction_from.length);
            encoder.string(this.transaction_from);
          }

          return buf;
        } // encode Swap
      } // Swap

      export class Mint {
        public sender: string = "";
        public owner: string = "";
        public tick_lower: string = "";
        public tick_upper: string = "";
        public amount: string = "";
        public amount0: string = "";
        public amount1: string = "";
        public log_index: i32;
        public transaction_from: string = "";

        // Decodes Mint from an ArrayBuffer
        static decode(buf: ArrayBuffer): Mint {
          return Mint.decodeDataView(new DataView(buf));
        }

        // Decodes Mint from a DataView
        static decodeDataView(view: DataView): Mint {
          const decoder = new __proto.Decoder(view);
          const obj = new Mint();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.sender = decoder.string();
                break;
              }
              case 2: {
                obj.owner = decoder.string();
                break;
              }
              case 3: {
                obj.tick_lower = decoder.string();
                break;
              }
              case 4: {
                obj.tick_upper = decoder.string();
                break;
              }
              case 5: {
                obj.amount = decoder.string();
                break;
              }
              case 6: {
                obj.amount0 = decoder.string();
                break;
              }
              case 7: {
                obj.amount1 = decoder.string();
                break;
              }
              case 8: {
                obj.log_index = decoder.int32();
                break;
              }
              case 9: {
                obj.transaction_from = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Mint

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.sender.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.sender.length) +
                this.sender.length
              : 0;
          size +=
            this.owner.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.owner.length) +
                this.owner.length
              : 0;
          size +=
            this.tick_lower.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tick_lower.length) +
                this.tick_lower.length
              : 0;
          size +=
            this.tick_upper.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tick_upper.length) +
                this.tick_upper.length
              : 0;
          size +=
            this.amount.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount.length) +
                this.amount.length
              : 0;
          size +=
            this.amount0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount0.length) +
                this.amount0.length
              : 0;
          size +=
            this.amount1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount1.length) +
                this.amount1.length
              : 0;
          size +=
            this.log_index == 0 ? 0 : 1 + __proto.Sizer.int32(this.log_index);
          size +=
            this.transaction_from.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.transaction_from.length) +
                this.transaction_from.length
              : 0;

          return size;
        }

        // Encodes Mint to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Mint to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.sender.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.sender.length);
            encoder.string(this.sender);
          }
          if (this.owner.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.owner.length);
            encoder.string(this.owner);
          }
          if (this.tick_lower.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.tick_lower.length);
            encoder.string(this.tick_lower);
          }
          if (this.tick_upper.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.tick_upper.length);
            encoder.string(this.tick_upper);
          }
          if (this.amount.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.amount.length);
            encoder.string(this.amount);
          }
          if (this.amount0.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.amount0.length);
            encoder.string(this.amount0);
          }
          if (this.amount1.length > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(this.amount1.length);
            encoder.string(this.amount1);
          }
          if (this.log_index != 0) {
            encoder.uint32(0x40);
            encoder.int32(this.log_index);
          }
          if (this.transaction_from.length > 0) {
            encoder.uint32(0x4a);
            encoder.uint32(this.transaction_from.length);
            encoder.string(this.transaction_from);
          }

          return buf;
        } // encode Mint
      } // Mint

      export class Burn {
        public owner: string = "";
        public tick_lower: string = "";
        public tick_upper: string = "";
        public amount: string = "";
        public amount0: string = "";
        public amount1: string = "";
        public log_index: i32;
        public transaction_from: string = "";

        // Decodes Burn from an ArrayBuffer
        static decode(buf: ArrayBuffer): Burn {
          return Burn.decodeDataView(new DataView(buf));
        }

        // Decodes Burn from a DataView
        static decodeDataView(view: DataView): Burn {
          const decoder = new __proto.Decoder(view);
          const obj = new Burn();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.owner = decoder.string();
                break;
              }
              case 2: {
                obj.tick_lower = decoder.string();
                break;
              }
              case 3: {
                obj.tick_upper = decoder.string();
                break;
              }
              case 4: {
                obj.amount = decoder.string();
                break;
              }
              case 5: {
                obj.amount0 = decoder.string();
                break;
              }
              case 6: {
                obj.amount1 = decoder.string();
                break;
              }
              case 7: {
                obj.log_index = decoder.int32();
                break;
              }
              case 8: {
                obj.transaction_from = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Burn

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.owner.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.owner.length) +
                this.owner.length
              : 0;
          size +=
            this.tick_lower.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tick_lower.length) +
                this.tick_lower.length
              : 0;
          size +=
            this.tick_upper.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tick_upper.length) +
                this.tick_upper.length
              : 0;
          size +=
            this.amount.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount.length) +
                this.amount.length
              : 0;
          size +=
            this.amount0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount0.length) +
                this.amount0.length
              : 0;
          size +=
            this.amount1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount1.length) +
                this.amount1.length
              : 0;
          size +=
            this.log_index == 0 ? 0 : 1 + __proto.Sizer.int32(this.log_index);
          size +=
            this.transaction_from.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.transaction_from.length) +
                this.transaction_from.length
              : 0;

          return size;
        }

        // Encodes Burn to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Burn to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.owner.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.owner.length);
            encoder.string(this.owner);
          }
          if (this.tick_lower.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.tick_lower.length);
            encoder.string(this.tick_lower);
          }
          if (this.tick_upper.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.tick_upper.length);
            encoder.string(this.tick_upper);
          }
          if (this.amount.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.amount.length);
            encoder.string(this.amount);
          }
          if (this.amount0.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.amount0.length);
            encoder.string(this.amount0);
          }
          if (this.amount1.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.amount1.length);
            encoder.string(this.amount1);
          }
          if (this.log_index != 0) {
            encoder.uint32(0x38);
            encoder.int32(this.log_index);
          }
          if (this.transaction_from.length > 0) {
            encoder.uint32(0x42);
            encoder.uint32(this.transaction_from.length);
            encoder.string(this.transaction_from);
          }

          return buf;
        } // encode Burn
      } // Burn

      export class Flash {
        public sender: string = "";
        public recipient: string = "";
        public amount0: string = "";
        public amount1: string = "";
        public paid0: string = "";
        public paid1: string = "";

        // Decodes Flash from an ArrayBuffer
        static decode(buf: ArrayBuffer): Flash {
          return Flash.decodeDataView(new DataView(buf));
        }

        // Decodes Flash from a DataView
        static decodeDataView(view: DataView): Flash {
          const decoder = new __proto.Decoder(view);
          const obj = new Flash();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.sender = decoder.string();
                break;
              }
              case 2: {
                obj.recipient = decoder.string();
                break;
              }
              case 3: {
                obj.amount0 = decoder.string();
                break;
              }
              case 4: {
                obj.amount1 = decoder.string();
                break;
              }
              case 5: {
                obj.paid0 = decoder.string();
                break;
              }
              case 6: {
                obj.paid1 = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Flash

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.sender.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.sender.length) +
                this.sender.length
              : 0;
          size +=
            this.recipient.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.recipient.length) +
                this.recipient.length
              : 0;
          size +=
            this.amount0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount0.length) +
                this.amount0.length
              : 0;
          size +=
            this.amount1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.amount1.length) +
                this.amount1.length
              : 0;
          size +=
            this.paid0.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.paid0.length) +
                this.paid0.length
              : 0;
          size +=
            this.paid1.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.paid1.length) +
                this.paid1.length
              : 0;

          return size;
        }

        // Encodes Flash to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Flash to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.sender.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.sender.length);
            encoder.string(this.sender);
          }
          if (this.recipient.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.recipient.length);
            encoder.string(this.recipient);
          }
          if (this.amount0.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.amount0.length);
            encoder.string(this.amount0);
          }
          if (this.amount1.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.amount1.length);
            encoder.string(this.amount1);
          }
          if (this.paid0.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.paid0.length);
            encoder.string(this.paid0);
          }
          if (this.paid1.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.paid1.length);
            encoder.string(this.paid1);
          }

          return buf;
        } // encode Flash
      } // Flash
    } // v1
  } // uniswap
  export namespace v1 {
    export enum EventType {
      // Factory
      POOL_CREATED = 0,
      // Position Manager
      INCREASE_LIQUIDITY = 1,
      DECREASE_LIQUIDITY = 2,
      COLLECT = 3,
      TRANSFER = 4,
      // Pool
      INITIALIZE = 5,
      SWAP = 6,
      MINT = 7,
      BURN = 8,
      FLASH = 9,
    } // EventType
    export class Events {
      public events: Array<Event> = new Array<Event>();

      // Decodes Events from an ArrayBuffer
      static decode(buf: ArrayBuffer): Events {
        return Events.decodeDataView(new DataView(buf));
      }

      // Decodes Events from a DataView
      static decodeDataView(view: DataView): Events {
        const decoder = new __proto.Decoder(view);
        const obj = new Events();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              const length = decoder.uint32();
              obj.events.push(
                Event.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                )
              );
              decoder.skip(length);

              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Events

      public size(): u32 {
        let size: u32 = 0;

        for (let n: i32 = 0; n < this.events.length; n++) {
          const messageSize = this.events[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes Events to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Events to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        for (let n: i32 = 0; n < this.events.length; n++) {
          const messageSize = this.events[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xa);
            encoder.uint32(messageSize);
            this.events[n].encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode Events
    } // Events

    // Every address is stored as hex string.
    export class Event {
      /**
       * Owner points to the address that originated this event
       *  The PoolCreated will set this to factory, which is what we can use
       *  to track different factories with compatible events.
       */
      public owner: string = "";
      public type: u32;
      public event: google.protobuf.Any = new google.protobuf.Any();
      public address: string = "";
      public tx_hash: Array<u8> = new Array<u8>();
      public tx_gas_used: string = "";
      public tx_gas_price: Array<u8> = new Array<u8>();
      /**
       * This duplicates data (as opposed to adding this data to the head) but AssemblyScript does
       *  not support closures and so using the data is not super easy if it's in the header so I'll
       *  leave it here.
       */
      public block_number: i32;
      public block_timestamp: string = "";

      // Decodes Event from an ArrayBuffer
      static decode(buf: ArrayBuffer): Event {
        return Event.decodeDataView(new DataView(buf));
      }

      // Decodes Event from a DataView
      static decodeDataView(view: DataView): Event {
        const decoder = new __proto.Decoder(view);
        const obj = new Event();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.owner = decoder.string();
              break;
            }
            case 2: {
              obj.type = decoder.uint32();
              break;
            }
            case 3: {
              const length = decoder.uint32();
              obj.event = google.protobuf.Any.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 4: {
              obj.address = decoder.string();
              break;
            }
            case 5: {
              obj.tx_hash = decoder.bytes();
              break;
            }
            case 6: {
              obj.tx_gas_used = decoder.string();
              break;
            }
            case 7: {
              obj.tx_gas_price = decoder.bytes();
              break;
            }
            case 8: {
              obj.block_number = decoder.int32();
              break;
            }
            case 9: {
              obj.block_timestamp = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Event

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.owner.length > 0
            ? 1 + __proto.Sizer.varint64(this.owner.length) + this.owner.length
            : 0;
        size += this.type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.type);

        if (this.event != null) {
          const f: google.protobuf.Any = this.event as google.protobuf.Any;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;
        size +=
          this.tx_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tx_hash.length) +
              this.tx_hash.length
            : 0;
        size +=
          this.tx_gas_used.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tx_gas_used.length) +
              this.tx_gas_used.length
            : 0;
        size +=
          this.tx_gas_price.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tx_gas_price.length) +
              this.tx_gas_price.length
            : 0;
        size +=
          this.block_number == 0
            ? 0
            : 1 + __proto.Sizer.int32(this.block_number);
        size +=
          this.block_timestamp.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.block_timestamp.length) +
              this.block_timestamp.length
            : 0;

        return size;
      }

      // Encodes Event to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Event to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.owner.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.owner.length);
          encoder.string(this.owner);
        }
        if (this.type != 0) {
          encoder.uint32(0x10);
          encoder.uint32(this.type);
        }

        if (this.event != null) {
          const f = this.event as google.protobuf.Any;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.address.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.address.length);
          encoder.string(this.address);
        }
        if (this.tx_hash.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.tx_hash.length);
          encoder.bytes(this.tx_hash);
        }
        if (this.tx_gas_used.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.tx_gas_used.length);
          encoder.string(this.tx_gas_used);
        }
        if (this.tx_gas_price.length > 0) {
          encoder.uint32(0x3a);
          encoder.uint32(this.tx_gas_price.length);
          encoder.bytes(this.tx_gas_price);
        }
        if (this.block_number != 0) {
          encoder.uint32(0x40);
          encoder.int32(this.block_number);
        }
        if (this.block_timestamp.length > 0) {
          encoder.uint32(0x4a);
          encoder.uint32(this.block_timestamp.length);
          encoder.string(this.block_timestamp);
        }

        return buf;
      } // encode Event
    } // Event

    // Factory
    export class PoolCreated {
      public token0: string = "";
      public token1: string = "";
      public fee: string = "";
      public tick_spacing: string = "";
      public pool: string = "";

      // Decodes PoolCreated from an ArrayBuffer
      static decode(buf: ArrayBuffer): PoolCreated {
        return PoolCreated.decodeDataView(new DataView(buf));
      }

      // Decodes PoolCreated from a DataView
      static decodeDataView(view: DataView): PoolCreated {
        const decoder = new __proto.Decoder(view);
        const obj = new PoolCreated();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.token0 = decoder.string();
              break;
            }
            case 2: {
              obj.token1 = decoder.string();
              break;
            }
            case 3: {
              obj.fee = decoder.string();
              break;
            }
            case 4: {
              obj.tick_spacing = decoder.string();
              break;
            }
            case 5: {
              obj.pool = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode PoolCreated

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.token0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.token0.length) +
              this.token0.length
            : 0;
        size +=
          this.token1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.token1.length) +
              this.token1.length
            : 0;
        size +=
          this.fee.length > 0
            ? 1 + __proto.Sizer.varint64(this.fee.length) + this.fee.length
            : 0;
        size +=
          this.tick_spacing.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tick_spacing.length) +
              this.tick_spacing.length
            : 0;
        size +=
          this.pool.length > 0
            ? 1 + __proto.Sizer.varint64(this.pool.length) + this.pool.length
            : 0;

        return size;
      }

      // Encodes PoolCreated to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes PoolCreated to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.token0.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.token0.length);
          encoder.string(this.token0);
        }
        if (this.token1.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.token1.length);
          encoder.string(this.token1);
        }
        if (this.fee.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.fee.length);
          encoder.string(this.fee);
        }
        if (this.tick_spacing.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.tick_spacing.length);
          encoder.string(this.tick_spacing);
        }
        if (this.pool.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.pool.length);
          encoder.string(this.pool);
        }

        return buf;
      } // encode PoolCreated
    } // PoolCreated

    // Position Manager
    export class IncreaseLiquidity {
      public token_id: string = "";
      public liquidity: string = "";
      public amount0: string = "";
      public amount1: string = "";

      // Decodes IncreaseLiquidity from an ArrayBuffer
      static decode(buf: ArrayBuffer): IncreaseLiquidity {
        return IncreaseLiquidity.decodeDataView(new DataView(buf));
      }

      // Decodes IncreaseLiquidity from a DataView
      static decodeDataView(view: DataView): IncreaseLiquidity {
        const decoder = new __proto.Decoder(view);
        const obj = new IncreaseLiquidity();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.token_id = decoder.string();
              break;
            }
            case 2: {
              obj.liquidity = decoder.string();
              break;
            }
            case 3: {
              obj.amount0 = decoder.string();
              break;
            }
            case 4: {
              obj.amount1 = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode IncreaseLiquidity

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.token_id.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.token_id.length) +
              this.token_id.length
            : 0;
        size +=
          this.liquidity.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.liquidity.length) +
              this.liquidity.length
            : 0;
        size +=
          this.amount0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount0.length) +
              this.amount0.length
            : 0;
        size +=
          this.amount1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount1.length) +
              this.amount1.length
            : 0;

        return size;
      }

      // Encodes IncreaseLiquidity to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes IncreaseLiquidity to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.token_id.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.token_id.length);
          encoder.string(this.token_id);
        }
        if (this.liquidity.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.liquidity.length);
          encoder.string(this.liquidity);
        }
        if (this.amount0.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.amount0.length);
          encoder.string(this.amount0);
        }
        if (this.amount1.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.amount1.length);
          encoder.string(this.amount1);
        }

        return buf;
      } // encode IncreaseLiquidity
    } // IncreaseLiquidity

    export class DecreaseLiquidity {
      public token_id: string = "";
      public liquidity: string = "";
      public amount0: string = "";
      public amount1: string = "";

      // Decodes DecreaseLiquidity from an ArrayBuffer
      static decode(buf: ArrayBuffer): DecreaseLiquidity {
        return DecreaseLiquidity.decodeDataView(new DataView(buf));
      }

      // Decodes DecreaseLiquidity from a DataView
      static decodeDataView(view: DataView): DecreaseLiquidity {
        const decoder = new __proto.Decoder(view);
        const obj = new DecreaseLiquidity();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.token_id = decoder.string();
              break;
            }
            case 2: {
              obj.liquidity = decoder.string();
              break;
            }
            case 3: {
              obj.amount0 = decoder.string();
              break;
            }
            case 4: {
              obj.amount1 = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode DecreaseLiquidity

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.token_id.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.token_id.length) +
              this.token_id.length
            : 0;
        size +=
          this.liquidity.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.liquidity.length) +
              this.liquidity.length
            : 0;
        size +=
          this.amount0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount0.length) +
              this.amount0.length
            : 0;
        size +=
          this.amount1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount1.length) +
              this.amount1.length
            : 0;

        return size;
      }

      // Encodes DecreaseLiquidity to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes DecreaseLiquidity to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.token_id.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.token_id.length);
          encoder.string(this.token_id);
        }
        if (this.liquidity.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.liquidity.length);
          encoder.string(this.liquidity);
        }
        if (this.amount0.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.amount0.length);
          encoder.string(this.amount0);
        }
        if (this.amount1.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.amount1.length);
          encoder.string(this.amount1);
        }

        return buf;
      } // encode DecreaseLiquidity
    } // DecreaseLiquidity

    export class Collect {
      public token_id: string = "";
      public recipient: string = "";
      public amount0: string = "";
      public amount1: string = "";

      // Decodes Collect from an ArrayBuffer
      static decode(buf: ArrayBuffer): Collect {
        return Collect.decodeDataView(new DataView(buf));
      }

      // Decodes Collect from a DataView
      static decodeDataView(view: DataView): Collect {
        const decoder = new __proto.Decoder(view);
        const obj = new Collect();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.token_id = decoder.string();
              break;
            }
            case 2: {
              obj.recipient = decoder.string();
              break;
            }
            case 3: {
              obj.amount0 = decoder.string();
              break;
            }
            case 4: {
              obj.amount1 = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Collect

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.token_id.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.token_id.length) +
              this.token_id.length
            : 0;
        size +=
          this.recipient.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.recipient.length) +
              this.recipient.length
            : 0;
        size +=
          this.amount0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount0.length) +
              this.amount0.length
            : 0;
        size +=
          this.amount1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount1.length) +
              this.amount1.length
            : 0;

        return size;
      }

      // Encodes Collect to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Collect to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.token_id.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.token_id.length);
          encoder.string(this.token_id);
        }
        if (this.recipient.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.recipient.length);
          encoder.string(this.recipient);
        }
        if (this.amount0.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.amount0.length);
          encoder.string(this.amount0);
        }
        if (this.amount1.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.amount1.length);
          encoder.string(this.amount1);
        }

        return buf;
      } // encode Collect
    } // Collect

    export class Transfer {
      public from: string = "";
      public to: string = "";
      public token_id: string = "";

      // Decodes Transfer from an ArrayBuffer
      static decode(buf: ArrayBuffer): Transfer {
        return Transfer.decodeDataView(new DataView(buf));
      }

      // Decodes Transfer from a DataView
      static decodeDataView(view: DataView): Transfer {
        const decoder = new __proto.Decoder(view);
        const obj = new Transfer();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.from = decoder.string();
              break;
            }
            case 2: {
              obj.to = decoder.string();
              break;
            }
            case 3: {
              obj.token_id = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Transfer

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.from.length > 0
            ? 1 + __proto.Sizer.varint64(this.from.length) + this.from.length
            : 0;
        size +=
          this.to.length > 0
            ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
            : 0;
        size +=
          this.token_id.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.token_id.length) +
              this.token_id.length
            : 0;

        return size;
      }

      // Encodes Transfer to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Transfer to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.from.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.from.length);
          encoder.string(this.from);
        }
        if (this.to.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.to.length);
          encoder.string(this.to);
        }
        if (this.token_id.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.token_id.length);
          encoder.string(this.token_id);
        }

        return buf;
      } // encode Transfer
    } // Transfer

    // Pool
    export class Initialize {
      public sqrt_price_x96: string = "";
      public tick: string = "";

      // Decodes Initialize from an ArrayBuffer
      static decode(buf: ArrayBuffer): Initialize {
        return Initialize.decodeDataView(new DataView(buf));
      }

      // Decodes Initialize from a DataView
      static decodeDataView(view: DataView): Initialize {
        const decoder = new __proto.Decoder(view);
        const obj = new Initialize();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.sqrt_price_x96 = decoder.string();
              break;
            }
            case 2: {
              obj.tick = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Initialize

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.sqrt_price_x96.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.sqrt_price_x96.length) +
              this.sqrt_price_x96.length
            : 0;
        size +=
          this.tick.length > 0
            ? 1 + __proto.Sizer.varint64(this.tick.length) + this.tick.length
            : 0;

        return size;
      }

      // Encodes Initialize to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Initialize to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.sqrt_price_x96.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.sqrt_price_x96.length);
          encoder.string(this.sqrt_price_x96);
        }
        if (this.tick.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.tick.length);
          encoder.string(this.tick);
        }

        return buf;
      } // encode Initialize
    } // Initialize

    export class Swap {
      public sender: string = "";
      public recipient: string = "";
      public amount0: string = "";
      public amount1: string = "";
      public sqrt_price_x96: string = "";
      public liquidity: string = "";
      public tick: string = "";
      public log_index: i32;
      public transaction_from: string = "";

      // Decodes Swap from an ArrayBuffer
      static decode(buf: ArrayBuffer): Swap {
        return Swap.decodeDataView(new DataView(buf));
      }

      // Decodes Swap from a DataView
      static decodeDataView(view: DataView): Swap {
        const decoder = new __proto.Decoder(view);
        const obj = new Swap();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.sender = decoder.string();
              break;
            }
            case 2: {
              obj.recipient = decoder.string();
              break;
            }
            case 3: {
              obj.amount0 = decoder.string();
              break;
            }
            case 4: {
              obj.amount1 = decoder.string();
              break;
            }
            case 5: {
              obj.sqrt_price_x96 = decoder.string();
              break;
            }
            case 6: {
              obj.liquidity = decoder.string();
              break;
            }
            case 7: {
              obj.tick = decoder.string();
              break;
            }
            case 8: {
              obj.log_index = decoder.int32();
              break;
            }
            case 9: {
              obj.transaction_from = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Swap

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.sender.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.sender.length) +
              this.sender.length
            : 0;
        size +=
          this.recipient.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.recipient.length) +
              this.recipient.length
            : 0;
        size +=
          this.amount0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount0.length) +
              this.amount0.length
            : 0;
        size +=
          this.amount1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount1.length) +
              this.amount1.length
            : 0;
        size +=
          this.sqrt_price_x96.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.sqrt_price_x96.length) +
              this.sqrt_price_x96.length
            : 0;
        size +=
          this.liquidity.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.liquidity.length) +
              this.liquidity.length
            : 0;
        size +=
          this.tick.length > 0
            ? 1 + __proto.Sizer.varint64(this.tick.length) + this.tick.length
            : 0;
        size +=
          this.log_index == 0 ? 0 : 1 + __proto.Sizer.int32(this.log_index);
        size +=
          this.transaction_from.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.transaction_from.length) +
              this.transaction_from.length
            : 0;

        return size;
      }

      // Encodes Swap to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Swap to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.sender.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.sender.length);
          encoder.string(this.sender);
        }
        if (this.recipient.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.recipient.length);
          encoder.string(this.recipient);
        }
        if (this.amount0.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.amount0.length);
          encoder.string(this.amount0);
        }
        if (this.amount1.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.amount1.length);
          encoder.string(this.amount1);
        }
        if (this.sqrt_price_x96.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.sqrt_price_x96.length);
          encoder.string(this.sqrt_price_x96);
        }
        if (this.liquidity.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.liquidity.length);
          encoder.string(this.liquidity);
        }
        if (this.tick.length > 0) {
          encoder.uint32(0x3a);
          encoder.uint32(this.tick.length);
          encoder.string(this.tick);
        }
        if (this.log_index != 0) {
          encoder.uint32(0x40);
          encoder.int32(this.log_index);
        }
        if (this.transaction_from.length > 0) {
          encoder.uint32(0x4a);
          encoder.uint32(this.transaction_from.length);
          encoder.string(this.transaction_from);
        }

        return buf;
      } // encode Swap
    } // Swap

    export class Mint {
      public sender: string = "";
      public owner: string = "";
      public tick_lower: string = "";
      public tick_upper: string = "";
      public amount: string = "";
      public amount0: string = "";
      public amount1: string = "";
      public log_index: i32;
      public transaction_from: string = "";

      // Decodes Mint from an ArrayBuffer
      static decode(buf: ArrayBuffer): Mint {
        return Mint.decodeDataView(new DataView(buf));
      }

      // Decodes Mint from a DataView
      static decodeDataView(view: DataView): Mint {
        const decoder = new __proto.Decoder(view);
        const obj = new Mint();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.sender = decoder.string();
              break;
            }
            case 2: {
              obj.owner = decoder.string();
              break;
            }
            case 3: {
              obj.tick_lower = decoder.string();
              break;
            }
            case 4: {
              obj.tick_upper = decoder.string();
              break;
            }
            case 5: {
              obj.amount = decoder.string();
              break;
            }
            case 6: {
              obj.amount0 = decoder.string();
              break;
            }
            case 7: {
              obj.amount1 = decoder.string();
              break;
            }
            case 8: {
              obj.log_index = decoder.int32();
              break;
            }
            case 9: {
              obj.transaction_from = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Mint

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.sender.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.sender.length) +
              this.sender.length
            : 0;
        size +=
          this.owner.length > 0
            ? 1 + __proto.Sizer.varint64(this.owner.length) + this.owner.length
            : 0;
        size +=
          this.tick_lower.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tick_lower.length) +
              this.tick_lower.length
            : 0;
        size +=
          this.tick_upper.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tick_upper.length) +
              this.tick_upper.length
            : 0;
        size +=
          this.amount.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount.length) +
              this.amount.length
            : 0;
        size +=
          this.amount0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount0.length) +
              this.amount0.length
            : 0;
        size +=
          this.amount1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount1.length) +
              this.amount1.length
            : 0;
        size +=
          this.log_index == 0 ? 0 : 1 + __proto.Sizer.int32(this.log_index);
        size +=
          this.transaction_from.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.transaction_from.length) +
              this.transaction_from.length
            : 0;

        return size;
      }

      // Encodes Mint to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Mint to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.sender.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.sender.length);
          encoder.string(this.sender);
        }
        if (this.owner.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.owner.length);
          encoder.string(this.owner);
        }
        if (this.tick_lower.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.tick_lower.length);
          encoder.string(this.tick_lower);
        }
        if (this.tick_upper.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.tick_upper.length);
          encoder.string(this.tick_upper);
        }
        if (this.amount.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.amount.length);
          encoder.string(this.amount);
        }
        if (this.amount0.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.amount0.length);
          encoder.string(this.amount0);
        }
        if (this.amount1.length > 0) {
          encoder.uint32(0x3a);
          encoder.uint32(this.amount1.length);
          encoder.string(this.amount1);
        }
        if (this.log_index != 0) {
          encoder.uint32(0x40);
          encoder.int32(this.log_index);
        }
        if (this.transaction_from.length > 0) {
          encoder.uint32(0x4a);
          encoder.uint32(this.transaction_from.length);
          encoder.string(this.transaction_from);
        }

        return buf;
      } // encode Mint
    } // Mint

    export class Burn {
      public owner: string = "";
      public tick_lower: string = "";
      public tick_upper: string = "";
      public amount: string = "";
      public amount0: string = "";
      public amount1: string = "";
      public log_index: i32;
      public transaction_from: string = "";

      // Decodes Burn from an ArrayBuffer
      static decode(buf: ArrayBuffer): Burn {
        return Burn.decodeDataView(new DataView(buf));
      }

      // Decodes Burn from a DataView
      static decodeDataView(view: DataView): Burn {
        const decoder = new __proto.Decoder(view);
        const obj = new Burn();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.owner = decoder.string();
              break;
            }
            case 2: {
              obj.tick_lower = decoder.string();
              break;
            }
            case 3: {
              obj.tick_upper = decoder.string();
              break;
            }
            case 4: {
              obj.amount = decoder.string();
              break;
            }
            case 5: {
              obj.amount0 = decoder.string();
              break;
            }
            case 6: {
              obj.amount1 = decoder.string();
              break;
            }
            case 7: {
              obj.log_index = decoder.int32();
              break;
            }
            case 8: {
              obj.transaction_from = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Burn

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.owner.length > 0
            ? 1 + __proto.Sizer.varint64(this.owner.length) + this.owner.length
            : 0;
        size +=
          this.tick_lower.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tick_lower.length) +
              this.tick_lower.length
            : 0;
        size +=
          this.tick_upper.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tick_upper.length) +
              this.tick_upper.length
            : 0;
        size +=
          this.amount.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount.length) +
              this.amount.length
            : 0;
        size +=
          this.amount0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount0.length) +
              this.amount0.length
            : 0;
        size +=
          this.amount1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount1.length) +
              this.amount1.length
            : 0;
        size +=
          this.log_index == 0 ? 0 : 1 + __proto.Sizer.int32(this.log_index);
        size +=
          this.transaction_from.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.transaction_from.length) +
              this.transaction_from.length
            : 0;

        return size;
      }

      // Encodes Burn to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Burn to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.owner.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.owner.length);
          encoder.string(this.owner);
        }
        if (this.tick_lower.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.tick_lower.length);
          encoder.string(this.tick_lower);
        }
        if (this.tick_upper.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.tick_upper.length);
          encoder.string(this.tick_upper);
        }
        if (this.amount.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.amount.length);
          encoder.string(this.amount);
        }
        if (this.amount0.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.amount0.length);
          encoder.string(this.amount0);
        }
        if (this.amount1.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.amount1.length);
          encoder.string(this.amount1);
        }
        if (this.log_index != 0) {
          encoder.uint32(0x38);
          encoder.int32(this.log_index);
        }
        if (this.transaction_from.length > 0) {
          encoder.uint32(0x42);
          encoder.uint32(this.transaction_from.length);
          encoder.string(this.transaction_from);
        }

        return buf;
      } // encode Burn
    } // Burn

    export class Flash {
      public sender: string = "";
      public recipient: string = "";
      public amount0: string = "";
      public amount1: string = "";
      public paid0: string = "";
      public paid1: string = "";

      // Decodes Flash from an ArrayBuffer
      static decode(buf: ArrayBuffer): Flash {
        return Flash.decodeDataView(new DataView(buf));
      }

      // Decodes Flash from a DataView
      static decodeDataView(view: DataView): Flash {
        const decoder = new __proto.Decoder(view);
        const obj = new Flash();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.sender = decoder.string();
              break;
            }
            case 2: {
              obj.recipient = decoder.string();
              break;
            }
            case 3: {
              obj.amount0 = decoder.string();
              break;
            }
            case 4: {
              obj.amount1 = decoder.string();
              break;
            }
            case 5: {
              obj.paid0 = decoder.string();
              break;
            }
            case 6: {
              obj.paid1 = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Flash

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.sender.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.sender.length) +
              this.sender.length
            : 0;
        size +=
          this.recipient.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.recipient.length) +
              this.recipient.length
            : 0;
        size +=
          this.amount0.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount0.length) +
              this.amount0.length
            : 0;
        size +=
          this.amount1.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.amount1.length) +
              this.amount1.length
            : 0;
        size +=
          this.paid0.length > 0
            ? 1 + __proto.Sizer.varint64(this.paid0.length) + this.paid0.length
            : 0;
        size +=
          this.paid1.length > 0
            ? 1 + __proto.Sizer.varint64(this.paid1.length) + this.paid1.length
            : 0;

        return size;
      }

      // Encodes Flash to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Flash to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.sender.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.sender.length);
          encoder.string(this.sender);
        }
        if (this.recipient.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.recipient.length);
          encoder.string(this.recipient);
        }
        if (this.amount0.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.amount0.length);
          encoder.string(this.amount0);
        }
        if (this.amount1.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.amount1.length);
          encoder.string(this.amount1);
        }
        if (this.paid0.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.paid0.length);
          encoder.string(this.paid0);
        }
        if (this.paid1.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.paid1.length);
          encoder.string(this.paid1);
        }

        return buf;
      } // encode Flash
    } // Flash
  } // v1
} // edgeandnode
