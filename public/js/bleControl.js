/**
 * BLE Control Module for HM-10
 * Manages Web Bluetooth API communication with HM-10 BLE module
 * Controls LED on/off via "1" and "0" commands
 */

class BLEController {
  constructor() {
    this.bleDevice = null;
    this.bleCharacteristic = null;
    this.isConnected = false;
    
    // HM-10 UUIDs
    this.SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
    this.CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";
    
    // UI callback handlers
    this.onStatusChange = null;
    this.onConnectionChange = null;
  }

  /**
   * Check if Web Bluetooth is supported
   */
  static isSupported() {
    return navigator.bluetooth !== undefined;
  }

  /**
   * Connect to HM-10 BLE device
   */
  async connect() {
    try {
      if (this.isConnected && this.bleCharacteristic) {
        console.log("✅ Already connected to HM-10");
        return true;
      }

      this.updateStatus("Connecting...", "info");

      // Request BLE device
      this.bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name: "HMSoft" }],
        optionalServices: [this.SERVICE_UUID],
      });

      console.log("✅ Device found:", this.bleDevice.name);
      this.updateStatus("Device found, connecting...", "info");

      // Get GATT server
      const server = await this.bleDevice.gatt.connect();
      console.log("✅ GATT Server connected");

      // Get service
      const service = await server.getPrimaryService(this.SERVICE_UUID);
      console.log("✅ Service found:", this.SERVICE_UUID);

      // Get characteristic
      this.bleCharacteristic = await service.getCharacteristic(this.CHAR_UUID);
      console.log("✅ Characteristic found:", this.CHAR_UUID);

      // Listen for disconnection
      this.bleDevice.addEventListener("gattserverdisconnected", () => {
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.updateStatus("Connected ✅", "success");
      this.onConnectionChange?.(true);

      console.log("✅ BLE Connected successfully!");
      return true;
    } catch (error) {
      console.error("❌ BLE Connection Error:", error);
      this.isConnected = false;
      this.updateStatus(`Failed: ${error.message}`, "error");
      this.onConnectionChange?.(false);
      return false;
    }
  }

  /**
   * Disconnect from HM-10
   */
  async disconnect() {
    try {
      if (this.bleDevice && this.bleDevice.gatt.connected) {
        await this.bleDevice.gatt.disconnect();
        console.log("✅ Disconnected from HM-10");
      }
      this.isConnected = false;
      this.bleDevice = null;
      this.bleCharacteristic = null;
      this.onConnectionChange?.(false);
    } catch (error) {
      console.error("❌ Disconnect Error:", error);
    }
  }

  /**
   * Send command to HM-10
   * @param {string} command - "1" for LED ON, "0" for LED OFF
   */
  async sendCommand(command) {
    try {
      // Ensure connection
      if (!this.isConnected || !this.bleCharacteristic) {
        console.log("⚠️ Not connected, attempting to connect...");
        const connected = await this.connect();
        if (!connected) {
          throw new Error("Failed to establish BLE connection");
        }
      }

      // Send command
      const data = new TextEncoder().encode(command);
      await this.bleCharacteristic.writeValue(data);

      console.log(`✅ Sent command to HM-10: "${command}"`);
      return true;
    } catch (error) {
      console.error("❌ Send Command Error:", error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Turn LED ON
   */
  async ledOn() {
    try {
      await this.sendCommand("1");
      this.updateStatus("LED ON ✅", "success");
      return true;
    } catch (error) {
      console.error("❌ LED ON Error:", error);
      this.updateStatus("LED ON Failed ❌", "error");
      return false;
    }
  }

  /**
   * Turn LED OFF
   */
  async ledOff() {
    try {
      await this.sendCommand("0");
      this.updateStatus("LED OFF ✅", "success");
      return true;
    } catch (error) {
      console.error("❌ LED OFF Error:", error);
      this.updateStatus("LED OFF Failed ❌", "error");
      return false;
    }
  }

  /**
   * Handle disconnection event
   */
  handleDisconnection() {
    console.log("⚠️ BLE Device Disconnected");
    this.isConnected = false;
    this.bleCharacteristic = null;
    this.updateStatus("Disconnected ⚠️", "warning");
    this.onConnectionChange?.(false);
  }

  /**
   * Update UI status
   * @param {string} message - Status message
   * @param {string} type - "info", "success", "error", "warning"
   */
  updateStatus(message, type = "info") {
    this.onStatusChange?.(message, type);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      deviceName: this.bleDevice?.name || "Not connected",
    };
  }
}

// Global instance
window.bleController = new BLEController();
