// ============================================================================
// KPay QR — Branded QR Code Generator (DataURL, SVG, Buffer)
// ============================================================================

import QRCode from 'qrcode';
import type { UPIQRRequest, UPIQRResponse } from '../types.js';
import { buildUPIUri } from './uri-builder.js';

/**
 * Generates an NPCI-compliant UPI QR Code as a base64 Data URL (PNG).
 * Defaulting to High (Level H) error correction for maximum scanning reliability.
 */
export async function generateUPIQR(request: UPIQRRequest): Promise<UPIQRResponse> {
  const upiUri = buildUPIUri(request);
  const dark = request.visualOptions?.darkColor ?? '#000000';
  const light = request.visualOptions?.lightColor ?? '#FFFFFF';
  const width = request.visualOptions?.width ?? 400;
  const margin = request.visualOptions?.margin ?? 2;

  const qrImage = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width,
    margin,
    color: { dark, light },
  });

  return {
    upiUri,
    qrImage,
    orderId: request.orderId,
    amount: request.amount,
  };
}

/**
 * Generates an SVG string representation of the UPI QR code.
 */
export async function generateUPIQRSvg(request: UPIQRRequest): Promise<string> {
  const upiUri = buildUPIUri(request);
  const dark = request.visualOptions?.darkColor ?? '#000000';
  const light = request.visualOptions?.lightColor ?? '#FFFFFF';
  const width = request.visualOptions?.width ?? 400;
  const margin = request.visualOptions?.margin ?? 2;

  return QRCode.toString(upiUri, {
    errorCorrectionLevel: 'H',
    type: 'svg',
    width,
    margin,
    color: { dark, light },
  });
}

/**
 * Generates a PNG Buffer representation of the UPI QR code.
 */
export async function generateUPIQRBuffer(request: UPIQRRequest): Promise<Buffer> {
  const upiUri = buildUPIUri(request);
  const dark = request.visualOptions?.darkColor ?? '#000000';
  const light = request.visualOptions?.lightColor ?? '#FFFFFF';
  const width = request.visualOptions?.width ?? 400;
  const margin = request.visualOptions?.margin ?? 2;

  return QRCode.toBuffer(upiUri, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width,
    margin,
    color: { dark, light },
  });
}
