import {
  Direction,
  IdentityKeyStore,
  KyberPreKeyRecord,
  KyberPreKeyStore,
  PreKeyRecord,
  PreKeyStore,
  PrivateKey,
  ProtocolAddress,
  PublicKey,
  SessionRecord,
  SessionStore,
  SignedPreKeyRecord,
  SignedPreKeyStore
} from "@signalapp/libsignal-client";

class InMemorySessionStore extends SessionStore {
  private store: Map<string, SessionRecord> = new Map();

  async saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void> {
    this.store.set(name.toString(), record);
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    return this.store.get(name.toString()) || null;
  }

  async getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]> {
    return addresses
      .map(addr => this.store.get(addr.toString()))
      .filter((record): record is SessionRecord => record !== undefined);
  }
}

class InMemoryPreKeyStore extends PreKeyStore {
  private store: Map<number, PreKeyRecord> = new Map();

  async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
    this.store.set(id, record);
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const record = this.store.get(id);
    if (!record) {
      throw new Error(`PreKey ${id} not found`);
    }
    return record;
  }

  async removePreKey(id: number): Promise<void> {
    this.store.delete(id);
  }
}

class InMemorySignedPreKeyStore extends SignedPreKeyStore {
  private store: Map<number, SignedPreKeyRecord> = new Map();

  async saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
    this.store.set(id, record);
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const record = this.store.get(id);
    if (!record) {
      throw new Error(`SignedPreKey ${id} not found`);
    }
    return record;
  }
}

class InMemoryKyberPreKeyStore extends KyberPreKeyStore {
  private store: Map<number, KyberPreKeyRecord> = new Map();

  async saveKyberPreKey(id: number, record: KyberPreKeyRecord): Promise<void> {
    this.store.set(id, record);
  }

  async getKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
    const record = this.store.get(id);
    if (!record) {
      throw new Error(`KyberPreKey ${id} not found`);
    }
    return record;
  }

  async markKyberPreKeyUsed(id: number): Promise<void> {
    console.log(`Marking KyberPreKey ${id} as used`);
  }
}

class InMemoryIdentityKeyStore extends IdentityKeyStore {
  private identityKey: PrivateKey;
  private registrationId: number;
  private store: Map<string, PublicKey>;

  constructor(identityKey: PrivateKey, registrationId: number) {
    super();
    this.identityKey = identityKey;
    this.registrationId = registrationId;
    this.store = new Map();
  }

  async getIdentityKey(): Promise<PrivateKey> {
    return this.identityKey;
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.registrationId;
  }

  async saveIdentity(name: ProtocolAddress, publicKey: PublicKey): Promise<boolean> {
    const existing = this.store.get(name.toString());
    this.store.set(name.toString(), publicKey);
    return !existing?.compare(publicKey);
  }

  async isTrustedIdentity(
    name: ProtocolAddress,
    publicKey: PublicKey,
    direction: Direction
  ): Promise<boolean> {
    return true;
  }

  async getIdentity(name: ProtocolAddress): Promise<PublicKey | null> {
    return this.store.get(name.toString()) || null;
  }
}

export {
  InMemorySessionStore,
  InMemoryPreKeyStore,
  InMemorySignedPreKeyStore,
  InMemoryKyberPreKeyStore,
  InMemoryIdentityKeyStore,
};
