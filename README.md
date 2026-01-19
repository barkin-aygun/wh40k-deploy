# 40K Deployment

[![Deploy](https://github.com/barkin-aygun/wh40k-deploy/actions/workflows/deploy.yml/badge.svg)](https://github.com/barkin-aygun/wh40k-deploy/actions/workflows/deploy.yml)

This app is there to load your armies, layouts and practice deployment. 

## To Do

### Deep Strike Denial

In the game, units can come from reserves onto the battlefield. Some units can do this anywhere on the field that is 9" away from any enemy models. So what we need is a way to render a 9" shape/circle around the base of a model indicating the areas where an enemy can not fit. This shape should be the collection of all points that are 9" or less close to the model.

There should be a button that does this for the entire army, allowing us to get a overview of what parts of battlefield are covered and not.

### Drag Move Ruler

While a model is being dragged, a line with a label should be drawn from where the model was to where it's moving, showing exactly how far the model is moving. This helps users visualize how far their model is moving and the limits.

### Ray casting from a unit out

One of the ways to figure out good deployment is making sure no models in the unit are visible to areas enemy can move their units into in their next turn. To that end, when a unit is selected, a button should allow a complete raycast from that unit, following visibility rules to show from what parts of the map that unit can be seen.

### Creation of a base size dataset

There are a lot of different models/units in the game. Their base sizes are listed, but some units have multiple models with different base sizes, some have Hull as their base indicating it's the model that determines LoS. I'd like you to provide me with a JSON that I can edit that maps faction > unit > models so I can create a dataset of all the models.

### Army Import

I'd like to go from a GW app exported army list (or one that's compacted), to a collection of bases representing the army. Some models (especially tanks and aircraft) go by hull rules, so we'll eventually need to support SVGs for these shapes. Refer to the units.json 

A staging area next to the battlefield is needed for the player. This will group all the bases on there, and let the player drag/drop them onto the battlefield.

Some units will have multiple models, and will have coherency rules. If a unit has 6 or less models, every model must be within 2" of at least one model of the unit. If it has 7 or more, every model must be within 2" of at least two other models of the unit. Units not in coherency during deployment should be marked as such.

Every unit should have a clear label that indicates where the unit is, ability to move the entire unit at once, or move individual models. Rotation for entire unit/model is also needed.
