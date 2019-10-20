const Lens = function(myr, radius) {
    const surface = new myr.Surface(radius + radius, radius + radius, 0, true, false);
    const displacement = Lens.makeDisplacement(myr, radius + radius);
    const shader = Lens.makeShader(myr, surface, displacement, radius + radius);
    const grid = new Grid(radius + radius, radius + radius);
    const flow = new Flow(radius + radius, radius + radius);
    const x = Math.floor((myr.getWidth() - (radius + radius)) * 0.5);
    const y = Math.floor((myr.getHeight() - (radius + radius)) * 0.5);
    const agents = [];
    let spawnTime = 0;

    const findSpawnLocation = () => {
        const flowDirection = new Myr.Vector(0, 0);
        const location = new Myr.Vector(0, 0);

        for (let i = 0; i < Lens.LOCATION_ATTEMPTS; ++i) {
            if (Math.random() < 0.5) {
                location.x = Math.random() * (radius + radius);

                if (Math.random() < 0.5)
                    location.y = 0;
                else
                    location.y = radius + radius - 0.001;
            }
            else {
                location.y = Math.random() * (radius + radius);

                if (Math.random() < 0.5)
                    location.x = 0;
                else
                    location.x = radius + radius - 0.001;
            }

            flowDirection.x = flowDirection.y = 0;
            flow.apply(location.x, location.y, flowDirection, 1);
            flowDirection.normalize();
            location.add(flowDirection);

            if (location.x < 0 ||
                location.y < 0 ||
                location.x >= radius + radius ||
                location.y >= radius + radius)
                continue;

            return location;
        }

        return null;
    };

    const spawn = agent => {
        agents.push(agent);
    };

    this.update = timeStep => {
        flow.update(timeStep);
        grid.update(timeStep);

        if ((spawnTime -= timeStep) < 0) {
            spawnTime += Lens.SPAWN_TIME;

            const position = findSpawnLocation();

            if (position) {
                const agent = new Agent(position, 32);

                flow.apply(agent.position.x, agent.position.y, agent.velocity, Lens.AGENT_SPAWN_BOOST);

                spawn(agent);
            }
        }

        for (let i = agents.length; i-- > 0;) {
            const agent = agents[i];

            flow.apply(agent.position.x, agent.position.y, agent.velocity, timeStep);
            agent.update(timeStep, spawn);
        }

        grid.populate(agents);
    };

    this.draw = () => {
        surface.bind();
        surface.clear();

        grid.draw(myr);
        flow.draw(myr);

        for (const agent of agents)
            agent.draw(myr);

        myr.primitives.drawCircle(
            Myr.Color.RED,
            radius,
            radius,
            radius);

        myr.bind();

        shader.draw(x, y);
    };

    this.free = () => {
        shader.free();
        surface.free();
        displacement.free();
    };

    spawn(new Agent(new Myr.Vector(radius, radius)));
};

Lens.makeDisplacement = (myr, diameter) => {
    const surface = new myr.Surface(diameter, diameter, 1, true, false);
    const cutoffCompensation = 1 / (2 - Lens.CUTOFF);
    const powerCompensation = 1 / (1 - Lens.CUTOFF);
    const shader = new myr.Shader(
        "void main() {" +
            "mediump float dx = uv.x - 0.5;" +
            "mediump float dy = uv.y - 0.5;" +
            "mediump float distSquared = dx * dx + dy * dy;" +
            "if (distSquared> 0.25)" +
                "color = vec4(0);" +
            "else {" +
                "mediump float dist = sqrt(distSquared) * 2.0;" +
                "mediump float cutoff = " + Lens.CUTOFF + ";" +
                "if (dist < cutoff)" +
                    "color = vec4(" +
                        "0.5 + dx * " + cutoffCompensation + "," +
                        "0.5 + dy * " + cutoffCompensation + "," +
                        "0, 1);" +
                "else {" +
                    "mediump float factor = " + Lens.CUTOFF + " + (dist - " + Lens.CUTOFF + " + " +
                        powerCompensation + " * (dist - " + Lens.CUTOFF + ") * (dist - " + Lens.CUTOFF + "));" +
                    "color = vec4(" +
                        "0.5 + dx * " + cutoffCompensation + " * factor / dist," +
                        "0.5 + dy * " + cutoffCompensation + " * factor / dist," +
                        "0, 1);" +
                "}" +
            "}" +
        "}",
        [],
        []);

    surface.bind();

    shader.setSize(diameter, diameter);
    shader.draw(0, 0);

    myr.bind();
    shader.free();

    return surface;
};

Lens.makeShader = (myr, surface, displacement) => {
    const shader = new myr.Shader(
        "void main() {" +
            "highp vec4 sourceUV = texture(displacement, uv);" +
            "mediump vec4 sourcePixel = texture(source, sourceUV.rg).rgba;" +
            "color = vec4(sourcePixel.rgb, sourcePixel.a * sourceUV.a);" +
        "}",
        [
            "source",
            "displacement"
        ],
        []);

    shader.setSurface("source", surface);
    shader.setSurface("displacement", displacement);

    return shader;
};

Lens.SPAWN_TIME = 3;
Lens.LOCATION_ATTEMPTS = 10;
Lens.AGENT_SPAWN_BOOST = 1;
Lens.CUTOFF = 0.9;