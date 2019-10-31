const LensMotion = function(size, padding, radius, resolution, transform, grid, dialAngle, dialZoom) {
    const State = function(focus, zoom, angle) {
        this.focus = focus;
        this.zoom = zoom;
        this.angle = angle;
        this.apply = (radius, transform) => {
            transform.identity();
            transform.scale(resolution, resolution);
            transform.translate(radius, radius);
            transform.scale(this.zoom, this.zoom);
            transform.rotate(this.angle);
            transform.translate(-this.focus.x, -this.focus.y);
        };

        this.copy = () => {
            return new State(this.focus.copy(), this.zoom, this.angle);
        };

        this.set = other => {
            this.focus.x = other.focus.x;
            this.focus.y = other.focus.y;
            this.zoom = other.zoom;
            this.angle = other.angle;

            if (this.angle > Math.PI + Math.PI)
                this.angle -= Math.PI + Math.PI;
            else if (this.angle < 0)
                this.angle += Math.PI + Math.PI;
        };
    };

    const Operation = {
        Focus: function(delta) {
            const length = delta.length();
            const direction = delta.copy();

            direction.normalize();

            this.getTime = () => length / Operation.TRANSLATE_SPEED;
            this.apply = (base, target, time) => {
                if (time === undefined) {
                    target.focus.x = base.focus.x + delta.x;
                    target.focus.y = base.focus.y + delta.y;
                }
                else {
                    target.focus.x = base.focus.x + time * Operation.TRANSLATE_SPEED * direction.x;
                    target.focus.y = base.focus.y + time * Operation.TRANSLATE_SPEED * direction.y;
                }
            };
        },
        Rotate: function(delta) {
            this.getTime = () => Math.abs(delta) / Operation.ROTATE_SPEED;
            this.apply = (base, target, time) => {
                if (time === undefined)
                    target.angle = base.angle + delta;
                else
                    target.angle = base.angle + time * Operation.ROTATE_SPEED * Math.sign(delta);
            };
        },
        Zoom: function(delta) {
            this.getTime = () => Math.abs(delta) / Operation.ZOOM_SPEED;
            this.apply = (base, target, time) => {
                if (time === undefined)
                    target.zoom = base.zoom + delta;
                else
                    target.zoom = base.zoom + time * Operation.ZOOM_SPEED * Math.sign(delta);
            };
        }
    };

    Operation.TRANSLATE_SPEED = 450;
    Operation.ROTATE_SPEED = 1.1;
    Operation.ZOOM_SPEED = 0.7;

    const operations = [];
    const stateBase = new State(new Myr.Vector(size * 0.5, size * 0.5), 1, 0);
    const state = stateBase.copy();
    let operationTime = 0;
    let operationDelay = LensMotion.OPERATION_DELAY_INITIAL;

    const addOperationRefocus = () => {
        const angleDelta = LensMotion.ANGLE_DELTA_MIN + (LensMotion.ANGLE_DELTA_MAX - LensMotion.ANGLE_DELTA_MIN) * Math.random();
        const focusDelta = new Myr.Vector(0, 0);
        let zoomDelta = LensMotion.ZOOM_DELTA_MIN + (LensMotion.ZOOM_DELTA_MAX - LensMotion.ZOOM_DELTA_MIN) * Math.random();

        if (Math.abs(zoomDelta) < LensMotion.ZOOM_THRESHOLD)
            zoomDelta = 0;
        else if (stateBase.zoom + zoomDelta < LensMotion.ZOOM_MIN ||
            stateBase.zoom + zoomDelta > LensMotion.ZOOM_MAX)
            zoomDelta = -zoomDelta;

        const focusPadding = padding + radius / (stateBase.zoom + zoomDelta);
        const centroids = grid.getCentroids();
        let focusX, focusY;

        for (let i = centroids.length; i-- > 0;) {
            const centroid = centroids[i];

            if (centroid.x < focusPadding ||
                centroid.y < focusPadding ||
                centroid.x > size - focusPadding * 2 ||
                centroid.y > size - focusPadding * 2)
                centroids.splice(i, 1);
        }

        if (centroids.length === 0) {
            focusX = focusPadding + (size - focusPadding - focusPadding) * Math.random();
            focusY = focusPadding + (size - focusPadding - focusPadding) * Math.random();
        }
        else {
            focusX = centroids[0].x;
            focusY = centroids[0].y;
        }

        focusDelta.x = focusX - stateBase.focus.x;
        focusDelta.y = focusY - stateBase.focus.y;

        let opZoom = null;
        let opFocus = null;

        if (zoomDelta !== 0)
            opZoom = new Operation.Zoom(zoomDelta);

        if (focusDelta.length() > LensMotion.FOCUS_THRESHOLD)
            opFocus = new Operation.Focus(focusDelta);

        if (zoomDelta < 0) {
            if (opFocus)
                operations.push(new Operation.Focus(focusDelta));

            if (opZoom)
                operations.push(opZoom);
        }
        else {
            if (opZoom)
                operations.push(opZoom);

            if (opFocus)
                operations.push(new Operation.Focus(focusDelta));
        }

        if (Math.abs(angleDelta) > LensMotion.ANGLE_THRESHOLD)
            operations.push(new Operation.Rotate(angleDelta));
    };

    const addOperations = () => {
        if (operations.length !== 0)
            return;

        addOperationRefocus();
    };

    this.getZoom = () => state.zoom;

    this.update = timeStep => {
        state.apply(radius, transform);

        if ((operationDelay -= timeStep) < 0) {
            operationDelay = LensMotion.OPERATION_DELAY_MIN + (LensMotion.OPERATION_DELAY_MAX - LensMotion.OPERATION_DELAY_MIN) * Math.random();

            addOperations();
        }

        if (operations.length !== 0) {
            if ((operationTime += timeStep) > operations[0].getTime()) {
                const operation = operations.shift();

                operationTime = 0;
                operation.apply(stateBase, stateBase);
                state.set(stateBase);
            }
            else
                operations[0].apply(stateBase, state, operationTime);

            dialAngle.setAngle(state.angle);
            dialZoom.setAngle(state.zoom * LensMotion.ZOOM_TO_ANGLE);
        }
    };
};

LensMotion.ZOOM_TO_ANGLE = 1.2;
LensMotion.ZOOM_MIN = 0.75;
LensMotion.ZOOM_MAX = 1.5;
LensMotion.ZOOM_THRESHOLD = 0.15;
LensMotion.ZOOM_DELTA_MIN = (LensMotion.ZOOM_MAX - LensMotion.ZOOM_MIN) * -0.5;
LensMotion.ZOOM_DELTA_MAX = -LensMotion.ZOOM_DELTA_MIN;
LensMotion.ANGLE_DELTA_MIN = -1.3;
LensMotion.ANGLE_DELTA_MAX = 1.3;
LensMotion.ANGLE_THRESHOLD = 0.2;
LensMotion.FOCUS_THRESHOLD = 60;
LensMotion.OPERATION_DELAY_INITIAL = 1;
LensMotion.OPERATION_DELAY_MIN = 3;
LensMotion.OPERATION_DELAY_MAX = 10;