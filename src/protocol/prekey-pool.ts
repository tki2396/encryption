// src/server.ts

import { PreKeyBundle } from "@signalapp/libsignal-client";
import { SignalProtocolManager } from ".";

// Add a class to manage prekey pools
class PreKeyPool {
  private preKeys: Map<number, PreKeyBundle> = new Map();
  private manager: SignalProtocolManager;
  private lastPreKeyId: number = 0;
  private readonly POOL_SIZE = 100;
  private readonly MIN_POOL_SIZE = 20;

  constructor(manager: SignalProtocolManager) {
    this.manager = manager;
  }

  async initialize() {
    await this.refillPool();
  }

  private async refillPool() {
    console.log("Refilling prekey pool...");
    while (this.preKeys.size < this.POOL_SIZE) {
      const bundle = await this.manager.createPreKeyBundle();
      this.preKeys.set(this.lastPreKeyId++, bundle);
    }
    console.log(`Pool refilled. Size: ${this.preKeys.size}`);
  }

  async getPreKeyBundle(): Promise<PreKeyBundle> {
    // If pool is getting low, refill in background
    if (this.preKeys.size < this.MIN_POOL_SIZE) {
      this.refillPool().catch(console.error);
    }

    // Get the oldest key from the pool
    const entries = this.preKeys.entries();
    const nextEntry = entries.next().value;
    if (!nextEntry) {
      throw new Error('No prekeys available');
    }
    const [id, bundle] = nextEntry;
    // Remove the used key
    this.preKeys.delete(id);
    return bundle;
  }
}

export { PreKeyPool }

// Modify the user manager storage to include prekey pools
// interface UserData {
//   manager: SignalProtocolManager;
//   prekeyPool: PreKeyPool;
// }

// const userManagers = new Map<string, UserData>();

// // Update the registration endpoint
// app.post('/register', async (req, res) => {
//   try {
//     const { userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({ error: 'userId is required' });
//     }

//     if (userManagers.has(userId)) {
//       return res.status(409).json({ error: 'User already registered' });
//     }

//     const manager = await initializeManager(userId);
//     const prekeyPool = new PreKeyPool(manager);
//     await prekeyPool.initialize();

//     userManagers.set(userId, { manager, prekeyPool });

//     // Get one prekey bundle for the initial response
//     const preKeyBundle = await prekeyPool.getPreKeyBundle();
//     const serializedBundle = serializePreKeyBundle(preKeyBundle);
    
//     res.json({
//       userId,
//       preKeyBundle: serializedBundle
//     });
//   } catch (error) {
//     console.error('Registration error:', error);
//     res.status(500).json({ error: 'Registration failed' });
//   }
// });

// // Update the prekey endpoint
// app.get('/prekey/:userId', async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const userData = userManagers.get(userId);

//     if (!userData) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const preKeyBundle = await userData.prekeyPool.getPreKeyBundle();
//     const serializedBundle = serializePreKeyBundle(preKeyBundle);
    
//     res.json({
//       userId,
//       preKeyBundle: serializedBundle
//     });
//   } catch (error) {
//     console.error('PreKey bundle error:', error);
//     res.status(500).json({ error: 'Failed to get PreKey bundle' });
//   }
// });
