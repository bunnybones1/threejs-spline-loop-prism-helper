var onReady = function() {
	var View = require('threejs-managed-view').View;
	var SplineLoop = require('threejs-spline-loop');
	var SplineLoopPrism = require('threejs-spline-loop-prism');
	var SplineLoopPrismHelper = require('./');
	var view = new View({
		useRafPolyfill: false
	});
	var scene = view.scene;
	view.camera.updateMatrixWorld();

	var pointsTotal = 8;
	var radius = 1.5;
	var points = [];
	for (var i = 0; i < pointsTotal; i++) {
		var ratio = i / pointsTotal;
		var radian = ratio * Math.PI * 2;
		var point = new THREE.Vector3();
		point.set(
			Math.cos(radian) * radius,
			1,
			Math.sin(radian) * radius
		);
		point.x += (Math.random() - .5) * .2;
		point.y += (Math.random() - .5) * .2;
		point.z += (Math.random() - .5) * .2;
		points.push(point);
	};

	var spline = new SplineLoop(points);
	spline.cache(100);

	var splinePrism = SplineLoopPrism.createFromSplineLoopAndScalarAndOffsetY(spline, .85, .3);
	splinePrism.cache(100);

	var splinePrismHelper = new SplineLoopPrismHelper(splinePrism, {
		handleRadius: .1,
		splineHelper: {
			handleRadius: .05
		}
	});

	scene.add(splinePrismHelper);

	var sampleBall = new THREE.Mesh(
		new THREE.SphereGeometry(.2),
		new THREE.MeshBasicMaterial({
			color: 0xff0000
		})
	);
	scene.add(sampleBall);

	var playHandle = splinePrismHelper.handles[3];
	playHandle.activate();
	var playHandleOriginalPosition = playHandle.position.clone();
	var playSubHandle = playHandle.subHandles[0];
	var playSubHandleOriginalPosition = playSubHandle.position.clone();
	view.renderManager.onEnterFrame.add(function() {
		var time = (new Date()).getTime() * .00003;
		sampleBall.position.copy(splinePrism.sample(time%1, Math.cos(time*100) * .5 + .5, Math.sin(time*100) * .5 + .5));
		if(playHandle.active) {
			playHandle.position.set(
				Math.cos(time*100)*.4,
				Math.sin(time*100)*.02,
				Math.cos(time*150)*.25
			).add(playHandleOriginalPosition);
			playHandle.update();
		}
		if(playSubHandle.active) {
			playSubHandle.position.set(
				Math.cos(time*100)*.4,
				Math.sin(time*100)*.02,
				Math.cos(time*150)*.25
			).add(playSubHandleOriginalPosition);
			playSubHandle.update();
		}
	})

	setTimeout(function() {
		playHandle.deactivate();
	}, 750);

	setTimeout(function() {
		playSubHandle.activate();
	}, 1000);

	setTimeout(function() {
		playSubHandle.deactivate();
	}, 4000);

	setTimeout(function() {
		playHandle.activate();
	}, 5000);
}

var loadAndRunScripts = require('loadandrunscripts');
loadAndRunScripts(
	[
		'bower_components/three.js/three.js'
	],
	onReady
);