const Voronoi = function(myr, width, height, maxDistance) {
    const color = new Myr.Color(0, 0, 1, 1);
    const shader = Voronoi.makeShader(myr, width, height);
    const surfaces = [
        new myr.Surface(width, height, 1, false, false),
        new myr.Surface(width, height, 1, false, false)];
    let front = 0;
    let maxStep = 1;

    this.prime = () => {
        surfaces[1 - front].bind();
        surfaces[1 - front].clear();
        surfaces[front].bind();
        surfaces[front].clear();
    };

    this.addSeed = (position, b) => {
        color.r = position.x / width;
        color.g = position.y / height;
        color.b = b;

        myr.primitives.drawPoint(color, position.x, position.y);
    };

    this.apply = () => {
        let step = maxStep;

        while (step !== 0.5) {
            shader.setSurface("source", surfaces[front]);
            shader.setVariable("step", step);

            front = 1 - front;

            surfaces[front].bind();
            shader.draw(0, 0);

            step *= 0.5;
        }
    };

    this.getSurface = () => {
        return surfaces[front];
    };

    this.free = () => {
        for (const surface of surfaces)
            surface.free();

        shader.free();
    };

    for (const surface of surfaces)
        surface.setClearColor(Voronoi.CLEAR_COLOR);

    if (maxDistance) {
        while (maxStep < maxDistance)
            maxStep <<= 1;
    }
    else {
        while (maxStep < width || maxStep < height)
            maxStep <<= 1;
    }

    maxStep >>= 1;
};

Voronoi.makeShader = (myr, width, height) => {
    return new myr.Shader(
        "void main() {" +
            "const mediump vec2 size = vec2(" + width + ", " + height + ");" +
            "mediump float bestDistance = 10000.0;" +
            "lowp vec4 bestSample = vec4(0);" +
            "for (int y = -1; y < 2; ++y) {" +
                "for (int x = -1; x < 2; ++x) {" +
                    "lowp vec4 pixel = texture(source, uv + vec2(x, y) * step * pixelSize);" +
                    "mediump float distance = length((pixel.xy - uv) * size);" +
                    "if (pixel.a != 0.0 && distance < bestDistance) {" +
                        "bestDistance = distance;" +
                        "bestSample = pixel;" +
                    "}" +
                "}" +
            "}" +
            "color = bestSample;" +
        "}",
        [
            "source"
        ],
        [
            "step"
        ]);
};

Voronoi.CLEAR_COLOR = new Myr.Color(0, 0, 0, 0);