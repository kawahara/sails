exports.definition = function(modelName) {
	var Model = sails.models[modelName];
	return {
		// Call findAll, unless this is a basic request, then render the index view
		index: function(req, res) {
			if(req.isAjax || req.isSocket) {
				if (req.param('id')) this.find(req, res);
				else this.findAll(req, res);
			} else res.view();
		},

		// Fetch a single model from testtable
		find: function (req,res) {
			if (!req.param('id')) return res.send(404);
			Model.find(req.param('id')).done(function (err, model) {
				if (err) return res.send(err, 500);
				else if (!model) return res.send(404);
				else return res.json(model);
			});
		},

		// Fetch paginated list of models from testtable
		findAll: function(req, res) {
			var options = {
				limit: req.param('limit') || undefined,
				offset: req.param('skip') || req.param('offset') || undefined,
				order: req.param('order') || undefined
			};

			// TODO: instead of ?search, allow search by attribute

			// Respond to queries
			var finding;
			var query = req.param('where') || req.param('search');
			var where = Model.filter(query);
			if(query) {
				finding = Model.findAllLike(where, options);
			} 
			// No WHERE criteria was specified, find all
			else finding = Model.findAll(options);

			finding.done(function afterFound (err, models) {
				if(err) return res.send(err, 500);
				if(!models) return res.send(404);

				// Subscribe to the models that were returned
				Model.subscribe(req, models);

				return res.json(models);
			});
		},

		// Store a new model
		create: function(req, res) {
			// Create monolithic parameter object
			var params = _.extend(req.query || {}, req.params || {}, req.body || {});

			Model.create(Model.filter(params), function(err, model) {
				if(err) return res.send(err, 500);

				// Broadcast success message
				Model.publish(req, null, {
					uri: Model.identity + '/create',
					data: model
				});

				// Since we just added a new model, we need to subscribe
				// all users currently in the class room to its updates
				Model.introduce(req, model.id);

				// Respond with model
				res.json(model);
			});
		},

		// Edit an existing model
		update: function(req, res) {
			// Create monolithic parameter object
			var params = _.extend(req.query || {}, req.params || {}, req.body || {});

			var id = req.param('id');
			if (!id) return res.send('Which model do I destroy?  No id provided!', 500);

			Model.update({
				id: id
			}, Model.filter(params), function(err, model) {
				if(err) return res.send(err, 500);
				if(!model) return res.send('Model cannot be found.', 500);

				// Broadcast success message
				Model.publish(req, [{
					id: id
				}], {
					uri: Model.identity + '/' + req.param('id') + '/update',
					data: model
				});

				// Publish update
				res.json(model);
			});
		},

		// Destroy a model
		destroy: function(req, res) {
			// Create monolithic parameter object
			var params = _.extend(req.query || {}, req.params || {}, req.body || {});

			var id = req.param('id');
			if (!id) return res.send('Which model do I destroy?  No id provided!', 500);

			Model.destroy(id, Model.filter(params), function(err) {
				if(err) return res.send(err, 500);

				// Broadcast success message
				Model.publish(req, [{
					id: id
				}], {
					uri: Model.identity + '/' + req.param('id') + '/destroy'
				});

				// Respond with model which was destroyed
				res.json({
					id: +req.param('id'),
					success: true
				});
			});
		}
	};
};