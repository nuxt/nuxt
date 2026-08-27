#version 300 es
precision highp float;

in vec2 vLocal;
in vec4 vTint;
/** 1 in light mode; uniform across the draw, so the branch is free */
uniform float uLight;
out vec4 fragColor;

void main () {
  float falloff = smoothstep(1.0, 0.45, length(vLocal));
  if (uLight > 0.5) {
    // premultiplied, so it composites over the page and settles on the ink
    // colour however much dust lands on it
    float alpha = vTint.a * falloff;
    fragColor = vec4(vTint.rgb * alpha, alpha);
  } else {
    fragColor = vec4(vTint.rgb * falloff, 1.0);
  }
}
