import {
  type Preset,
  defineConfig,
  presetUno,
  presetAttributify,
  transformerDirectives,
  transformerVariantGroup,
  SourceCodeTransformer,
} from "unocss";

import {
  presetApplet,
  presetRemRpx,
  transformerApplet,
  transformerAttributify,
} from "unocss-applet";

const isApplet = process.env?.UNI_PLATFORM?.startsWith("mp-") ?? false;

const presets: Preset[] = [];
const transformers: SourceCodeTransformer[] = [];

if (isApplet) {
  presets.push(
    presetApplet(),
    presetRemRpx()
  );
  transformers.push(
    transformerApplet(),
    transformerAttributify({
      prefixedOnly: true,
      prefix: "ul",
    })
  );
} else {
  presets.push(
    presetUno(),
    presetAttributify({
      prefixedOnly: true,
      prefix: "ul",
    })
  );
  transformers.push(
    transformerDirectives(),
    transformerVariantGroup()
  );
}

export default defineConfig({
  presets: [
    ...presets,
  ],
  transformers: [
    ...transformers,
  ],
});
