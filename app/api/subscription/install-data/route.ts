
import { NextRequest, NextResponse } from "next/server";
import {
  encodeAbiParameters,
  parseAbiParameters,
  getAddress,
} from "viem";
import {
  getDefaultSingleSignerValidationModuleAddress,
  HookType,
  SingleSignerValidationModule,
} from "@account-kit/smart-contracts/experimental";
import { sepolia } from "@account-kit/infra";
import { getSessionKey } from "@/lib/persist"; // <-- from the JSON store helper

export const runtime = "nodejs";

const SUBSCRIPTION_MODULE_ADDRESS = "0xe0ca7D210Ff0CC219072e1727ECB0f2BD67866ba";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const MERCHANT_ADDRESS = "0xdbcafd921b6b2e3d92d0d8b6489cf3d84dbf149f";

// You used 6 as the hook entityId previously. Keeping it the same for now.
// For multi-merchant or multi-subscription support, consider deriving this per user or per plan.
const HOOK_ENTITY_ID = 6;

// Validation entity id used by SingleSignerValidationModule
const VALIDATION_ENTITY_ID = 2;

export async function POST(req: NextRequest) {
  const { userId, sessionKeyAddress, accountAddress } = await req.json();

  if (!userId || !sessionKeyAddress || !accountAddress) {
    return NextResponse.json(
      { error: "Missing userId/sessionKeyAddress/accountAddress" },
      { status: 400 }
    );
  }

  // Ensure the session key exists and matches the address we expect for this user
  const sess = getSessionKey(userId);
  if (!sess) {
    return NextResponse.json(
      { error: "No session key found for user" },
      { status: 404 }
    );
  }
  // Validate the provided session key address matches what we persisted
  if (sess.publicKey.toLowerCase() !== sessionKeyAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "Session key address mismatch" },
      { status: 400 }
    );
  }
  // Optional: ensure the accountAddress is the one we saved when creating the session
  if (sess.accountAddress.toLowerCase() !== accountAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "Account address mismatch" },
      { status: 400 }
    );
  }

  // Configure the subscription hook parameters
  const config = {
    hookEntityId: HOOK_ENTITY_ID,
    merchant: MERCHANT_ADDRESS,
    token: USDC_SEPOLIA,
    maxPerPeriod: 10n * 10n ** 6n, // $10/month in 6-decimal USDC
    periodSecs: 30n * 24n * 60n * 60n, // 30 days
    validUntil: BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60), // 1 year from now
    paused: false,
  };

  // ABI-encode the onInstall init data used by both Validation & Execution hooks
  const onInstallData = encodeAbiParameters(
    parseAbiParameters(
      "uint32 entityId, address merchant, address token, uint256 maxPerPeriod, uint48 periodSecs, uint48 validUntil, bool paused"
    ),
    [
      config.hookEntityId,
      getAddress(config.merchant),
      getAddress(config.token),
      config.maxPerPeriod,
      Number(config.periodSecs),
      Number(config.validUntil),
      config.paused,
    ]
  );

  // Single-signer validation module on Sepolia
  const ecdsaValidationModuleAddress =
    getDefaultSingleSignerValidationModuleAddress(sepolia);

  // Build response payload (same shape your UI expects)
  return NextResponse.json({
    validationConfig: {
      moduleAddress: ecdsaValidationModuleAddress,
      entityId: VALIDATION_ENTITY_ID,
      isGlobal: true,
      isSignatureValidation: true,
      isUserOpValidation: true,
    },
    installData: SingleSignerValidationModule.encodeOnInstallData({
      entityId: VALIDATION_ENTITY_ID,
      signer: sessionKeyAddress, // the session key EOA we generated & persisted
    }),
    hooks: [
      {
        hookConfig: {
          address: SUBSCRIPTION_MODULE_ADDRESS,
          entityId: config.hookEntityId,
          hookType: HookType.VALIDATION,
          hasPreHooks: true,
          hasPostHooks: false,
        },
        initData: onInstallData,
      },
      {
        hookConfig: {
          address: SUBSCRIPTION_MODULE_ADDRESS,
          entityId: config.hookEntityId,
          hookType: HookType.EXECUTION,
          hasPreHooks: true,
          hasPostHooks: false,
        },
        initData: onInstallData,
      },
    ],
  });
}
