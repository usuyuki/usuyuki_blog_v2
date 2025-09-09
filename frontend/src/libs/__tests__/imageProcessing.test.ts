import { describe, it, expect, beforeAll } from 'vitest';
import https from 'node:https';
import { Buffer } from 'node:buffer';

describe('Image Processing Tests', () => {
  const testImages = [
    'https://blogapi.usuyuki.net/content/images/size/w600/2025/08/DSC_0017.JPG',
    'https://blogapi.usuyuki.net/content/images/size/w600/2025/06/1000012376.jpg',
    'https://blogapi.usuyuki.net/content/images/size/w600/2025/06/---------_2025-06-24_00-38-21.png',
    'https://blogapi.usuyuki.net/content/images/size/w600/2024/12/PXL_20241218_111157101--1-.jpg'
  ];

  const astroImageEndpoint = 'http://localhost:1000/_image';

  function downloadImage(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
    });
  }

  async function fetchImageViaAstro(imageUrl: string): Promise<Response> {
    const params = new URLSearchParams({
      href: imageUrl,
      w: '480',
      h: '480',
      q: '80',
      f: 'webp'
    });
    
    return fetch(`${astroImageEndpoint}?${params}`);
  }

  describe('Direct Image Download Tests', () => {
    testImages.forEach((imageUrl) => {
      it(`should download ${imageUrl.split('/').pop()} successfully`, async () => {
        const buffer = await downloadImage(imageUrl);
        
        expect(buffer.length).toBeGreaterThan(0);
        
        // Check for JPEG signature
        if (imageUrl.toLowerCase().includes('.jpg') || imageUrl.toLowerCase().includes('.jpeg')) {
          expect(buffer[0]).toBe(0xff);
          expect(buffer[1]).toBe(0xd8);
        }
        
        // Check for PNG signature
        if (imageUrl.toLowerCase().includes('.png')) {
          const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
          expect(buffer.slice(0, 8).equals(pngSignature)).toBe(true);
        }
        
        // Check for UTF-8 corruption
        const hasUTF8Corruption = buffer.slice(0, 20).includes(0xef) && 
                                  buffer.slice(0, 20).includes(0xbf) && 
                                  buffer.slice(0, 20).includes(0xbd);
        expect(hasUTF8Corruption).toBe(false);
      });
    });
  });

  describe('Node.js fetch() Tests', () => {
    testImages.forEach((imageUrl) => {
      it(`should fetch ${imageUrl.split('/').pop()} via native fetch`, async () => {
        const response = await fetch(imageUrl);
        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toContain('image');
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        expect(buffer.length).toBeGreaterThan(0);
        
        // Validate image format
        if (imageUrl.toLowerCase().includes('.jpg') || imageUrl.toLowerCase().includes('.jpeg')) {
          expect(buffer[0]).toBe(0xff);
          expect(buffer[1]).toBe(0xd8);
        }
        
        if (imageUrl.toLowerCase().includes('.png')) {
          const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
          expect(buffer.slice(0, 8).equals(pngSignature)).toBe(true);
        }
      });
    });
  });

  describe('Astro Image Processing Tests', () => {
    testImages.forEach((imageUrl) => {
      it(`should process ${imageUrl.split('/').pop()} through Astro endpoint`, async () => {
        const response = await fetchImageViaAstro(imageUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Astro processing failed for ${imageUrl}:`, errorText);
          
          // Log the full error for debugging
          expect.soft(response.status).toBe(200);
          expect.soft(errorText).not.toContain('Could not process image request');
        } else {
          expect(response.status).toBe(200);
          expect(response.headers.get('content-type')).toContain('image');
          
          const buffer = await response.arrayBuffer();
          expect(buffer.byteLength).toBeGreaterThan(0);
          
          // Check for WebP signature (since we're converting to WebP)
          const webpBuffer = Buffer.from(buffer);
          expect(webpBuffer.slice(0, 4).toString()).toBe('RIFF');
          expect(webpBuffer.slice(8, 12).toString()).toBe('WEBP');
        }
      });
    });
  });

  describe('Sharp Processing Tests', () => {
    it('should handle various image formats with Sharp directly', async () => {
      const sharp = await import('sharp');
      
      for (const imageUrl of testImages) {
        console.log(`Testing Sharp processing for: ${imageUrl}`);
        
        const buffer = await downloadImage(imageUrl);
        
        try {
          const sharpInstance = sharp.default(buffer);
          const metadata = await sharpInstance.metadata();
          
          expect(metadata.format).toMatch(/jpeg|png|webp/);
          expect(metadata.width).toBeGreaterThan(0);
          expect(metadata.height).toBeGreaterThan(0);
          
          // Test conversion to WebP
          const webpResult = await sharpInstance
            .resize(480, 480, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();
            
          expect(webpResult.length).toBeGreaterThan(0);
          
          // Verify WebP output
          expect(webpResult.slice(0, 4).toString()).toBe('RIFF');
          expect(webpResult.slice(8, 12).toString()).toBe('WEBP');
          
        } catch (error) {
          console.error(`Sharp processing failed for ${imageUrl}:`, error);
          throw error;
        }
      }
    });
  });

  describe('Error Detection Tests', () => {
    it('should detect corrupted image data', async () => {
      const sharp = await import('sharp');
      
      const testCases = [
        { name: 'empty buffer', data: Buffer.alloc(0) },
        { name: 'text data', data: Buffer.from('not an image') },
        { name: 'HTML response', data: Buffer.from('<!DOCTYPE html><html>Error</html>') },
        { name: 'UTF-8 corrupted', data: Buffer.from([0xef, 0xbf, 0xbd, 0xef, 0xbf, 0xbd]) }
      ];
      
      for (const testCase of testCases) {
        try {
          const result = await sharp.default(testCase.data).toBuffer();
          expect.fail(`Should have failed for ${testCase.name}, but got buffer of length ${result.length}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toMatch(/input|buffer|format/i);
        }
      }
    });
  });

  describe('Encoding Issues Tests', () => {
    it('should detect UTF-8 replacement characters in image data', () => {
      // This is what we saw in the debug logs
      const corruptedData = Buffer.from('efbfbdefbfbdefbfbdefbfbd0043000606060607', 'hex');
      
      const hasUTF8Corruption = corruptedData.includes(0xef) && 
                                corruptedData.includes(0xbf) && 
                                corruptedData.includes(0xbd);
      
      expect(hasUTF8Corruption).toBe(true);
      
      // This should not be a valid JPEG
      const isValidJPEG = corruptedData[0] === 0xff && corruptedData[1] === 0xd8;
      expect(isValidJPEG).toBe(false);
    });
    
    it('should correctly identify valid JPEG data', () => {
      const validJPEG = Buffer.from('ffd8ffdb004300060606060706070808070a0b0a', 'hex');
      
      const isValidJPEG = validJPEG[0] === 0xff && validJPEG[1] === 0xd8;
      expect(isValidJPEG).toBe(true);
      
      const hasUTF8Corruption = validJPEG.slice(0, 20).includes(0xef) && 
                                validJPEG.slice(0, 20).includes(0xbf) && 
                                validJPEG.slice(0, 20).includes(0xbd);
      expect(hasUTF8Corruption).toBe(false);
    });
  });
});