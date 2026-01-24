# 40K Deployment

[![Deploy](https://github.com/barkin-aygun/wh40k-deploy/actions/workflows/deploy.yml/badge.svg)](https://github.com/barkin-aygun/wh40k-deploy/actions/workflows/deploy.yml)

This app is there to load your armies, layouts and practice deployment. 

## To Do

### Ray casting from a unit out

One of the ways to figure out good deployment is making sure no models in the unit are visible to areas enemy can move their units into in their next turn. To that end, when a unit is selected, a button should allow a complete raycast from that unit, following visibility rules to show from what parts of the map that unit can be seen.

### Coherency

A unit (group) of models need to always adhere to the following constraints:

If there are 7 or more models, each model has to be within 2" of at least two other models from the same unit.
If there are 6 or less, each model has to be within 2" of at least one other model from the same unit.

If a unit is not in coherence, their base color should indicate this bad state somehow.

### Coherency respecting move

It would be nice to move individual models of a unit while enforcing coherency, via an option or a modifier key. That way, a player can stretch out a unit as far as they can making sure coherency is respected. Of course, player can pick up the entire unit and move it without measuring coherency.