import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CustomerInfo, Purchases, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { SettingsService } from './settings.service';

// TODO: fill in from the RevenueCat project dashboard (Project settings >
// API keys) once it exists - each platform has its own public SDK key.
// Safe to commit: these are the client-side public keys, not secrets.
const REVENUECAT_API_KEY_ANDROID = '';
const REVENUECAT_API_KEY_IOS = '';

// Must match the entitlement identifier configured in the RevenueCat
// dashboard's Entitlements tab - this is what unlocks AppSettings.isPro.
const PRO_ENTITLEMENT_ID = 'pro';

// Drives AppSettings.isPro from a real purchase once the app runs inside
// the native Capacitor shell with a configured RevenueCat project - see
// isAvailable below for exactly when that is. Until then (in the browser,
// or before the API keys above are filled in), Config's own "Pro Version"
// checkbox remains the only way to flip isPro, unchanged from before this
// service existed.
@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private configured = false;

  constructor(private readonly settingsService: SettingsService) {}

  private get currentApiKey(): string {
    return Capacitor.getPlatform() === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  }

  // False in the browser and on any platform whose API key hasn't been
  // filled in yet, so Config can decide whether to show the real
  // buy/restore buttons or keep the manual dev toggle.
  get isAvailable(): boolean {
    return Capacitor.isNativePlatform() && !!this.currentApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.isAvailable || this.configured) {
      return;
    }
    await Purchases.configure({ apiKey: this.currentApiKey });
    this.configured = true;
    await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      void this.applyCustomerInfo(customerInfo);
    });
    await this.refreshEntitlement();
  }

  async refreshEntitlement(): Promise<void> {
    if (!this.configured) {
      return;
    }
    const { customerInfo } = await Purchases.getCustomerInfo();
    await this.applyCustomerInfo(customerInfo);
  }

  private async applyCustomerInfo(customerInfo: CustomerInfo): Promise<void> {
    const isPro = !!customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
    await this.settingsService.updateSettings({ isPro });
  }

  // The one package Config offers for purchase - prefers a configured
  // lifetime (one-time) package, since Pro here is meant to be a single
  // unlock rather than a subscription, falling back to whatever else the
  // current offering has rather than hard-coding a specific RevenueCat
  // product identifier.
  async getProPackage(): Promise<PurchasesPackage | null> {
    if (!this.configured) {
      return null;
    }
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;
    return offering?.lifetime ?? offering?.availablePackages[0] ?? null;
  }

  async purchasePro(): Promise<void> {
    const aPackage = await this.getProPackage();
    if (!aPackage) {
      throw new Error('No Pro package configured in RevenueCat.');
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage });
    await this.applyCustomerInfo(customerInfo);
  }

  async restorePurchases(): Promise<void> {
    if (!this.configured) {
      return;
    }
    const { customerInfo } = await Purchases.restorePurchases();
    await this.applyCustomerInfo(customerInfo);
  }
}
