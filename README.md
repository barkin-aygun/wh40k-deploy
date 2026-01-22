# 40K Deployment

[![Deploy](https://github.com/barkin-aygun/wh40k-deploy/actions/workflows/deploy.yml/badge.svg)](https://github.com/barkin-aygun/wh40k-deploy/actions/workflows/deploy.yml)

This app is there to load your armies, layouts and practice deployment. 

## To Do

### Ray casting from a unit out

One of the ways to figure out good deployment is making sure no models in the unit are visible to areas enemy can move their units into in their next turn. To that end, when a unit is selected, a button should allow a complete raycast from that unit, following visibility rules to show from what parts of the map that unit can be seen.

### Model Grouping for Units

In Warhammer, a unit is made up of multiple models. It would be nice to be able to have a hierarchy to models so units can be defined on army import / and be moved as a unit. Ctrl+click would choose individual bases within a unit.

### Unit Visibility

It's enough to see one model in a unit to be eligible to shoot at it. So most of the time, visibility calculations for an entire unit is done on every model and decided that way.

### Coherency

If there are 7 or more models, each model has to be within 2" of at least two other models from the same unit.
If there are 6 or less, each model has to be within 2" of at least one other model from the same unit.

### Coherency respecting move

It would be nice to move individual models of a unit while enforcing coherency, via an option or a modifier key. That way, a player can stretch out a unit as far as they can making sure coherency is respected. Of course, player can pick up the entire unit and move it without measuring coherency.