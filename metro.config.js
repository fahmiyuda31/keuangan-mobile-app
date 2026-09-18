const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable wasm for expo-sqlite web and gguf for on-device AI models
config.resolver.assetExts.push('wasm', 'gguf');

module.exports = config;
