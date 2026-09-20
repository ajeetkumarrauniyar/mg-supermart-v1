/**
 * Address Controller (D-003, D-012).
 *
 * Every response carries a freshly computed `serviceability`; nothing about
 * serviceability is ever stored. A well-formed address is always accepted —
 * being outside the radius is information, not an error.
 */
import { Request, Response, NextFunction } from "express";
import { AddressRepository, type StoredAddress } from "../repositories/AddressRepository.js";
import { validateAddressInput } from "../utils/validation.js";
import { ApiError } from "../utils/errorHandler.js";
import { computeServiceability } from "../domain/serviceability.js";
import { getStoreConfig, ConfigError } from "../config/storeConfig.js";
import type { AddressResponse } from "../models/Address.js";
import type { StoreConfig } from "../domain/types.js";

/** Translate a missing/invalid StoreConfig into 503 CONFIG_UNAVAILABLE (D-014). */
export const requireStoreConfig = (): StoreConfig => {
  try {
    return getStoreConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      throw new ApiError(
        "Store configuration is unavailable",
        503,
        undefined,
        "CONFIG_UNAVAILABLE"
      );
    }
    throw e;
  }
};

export const withServiceability = (
  address: StoredAddress,
  config: StoreConfig
): AddressResponse => {
  const { userId: _owner, ...rest } = address;
  return {
    ...rest,
    serviceability: computeServiceability({ lat: address.lat, lng: address.lng }, config),
  };
};

export class AddressController {
  private addressRepository: AddressRepository;

  constructor() {
    this.addressRepository = new AddressRepository();
  }

  private userId(req: Request): string {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError("User not authenticated", 401);
    }
    return userId;
  }

  private addressId(req: Request): string {
    const { addressId } = req.params as Record<string, string>;
    if (!addressId) {
      throw new ApiError("Address ID is required", 400);
    }
    return addressId;
  }

  /** Cross-user ids resolve to "not found" on the caller's path ⇒ 403 ADDRESS_NOT_OWNED. */
  private notOwned(): ApiError {
    return new ApiError("Address not found for this account", 403, "addressId", "ADDRESS_NOT_OWNED");
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.userId(req);
      const config = requireStoreConfig();
      const addresses = await this.addressRepository.list(userId);
      res.json({
        success: true,
        data: addresses.map((a) => withServiceability(a, config)),
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.userId(req);
      const config = requireStoreConfig();
      const input = validateAddressInput(req.body ?? {});
      const created = await this.addressRepository.create(userId, input);
      res.status(201).json({
        success: true,
        message: "Address saved",
        data: withServiceability(created, config),
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.userId(req);
      const addressId = this.addressId(req);
      const config = requireStoreConfig();
      const input = validateAddressInput(req.body ?? {});
      const updated = await this.addressRepository.update(userId, addressId, input);
      if (!updated) {
        throw this.notOwned();
      }
      res.json({
        success: true,
        message: "Address updated",
        data: withServiceability(updated, config),
      });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.userId(req);
      const addressId = this.addressId(req);
      const deleted = await this.addressRepository.delete(userId, addressId);
      if (!deleted) {
        throw this.notOwned();
      }
      res.json({ success: true, message: "Address deleted" });
    } catch (error) {
      next(error);
    }
  };

  setDefault = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.userId(req);
      const addressId = this.addressId(req);
      const config = requireStoreConfig();
      const updated = await this.addressRepository.setDefault(userId, addressId);
      if (!updated) {
        throw this.notOwned();
      }
      res.json({
        success: true,
        message: "Default address updated",
        data: withServiceability(updated, config),
      });
    } catch (error) {
      next(error);
    }
  };
}
