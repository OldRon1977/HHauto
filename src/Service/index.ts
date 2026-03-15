/**
 * Barrel export for the Service layer.
 *
 * Re-exports every public symbol from each service module so that the rest
 * of the codebase can import from `Service/index` instead of reaching into
 * individual files. Keeping a single entry point makes dependency wiring
 * easier and keeps import paths short.
 *
 * Key services:
 *  - StartService   -- one-time initialization, menu setup, version migration
 *  - AutoLoop       -- the main periodic automation loop
 *  - AutoLoopActions / AutoLoopPageHandlers -- discrete action handlers called by the loop
 *  - ParanoiaService -- anti-detection pause/resume logic
 *  - PageNavigationService -- centralized in-game page navigation
 *  - InfoService    -- player info overlay (pInfo panel)
 *  - MouseService   -- pause automation while the user interacts with the page
 *  - AdsService     -- suppress or relocate in-game ads
 *  - TooltipService -- show/hide HHAuto menu tooltips
 */
export * from './AdsService'
export * from './AutoLoop'
export * from './AutoLoopActions'
export * from './AutoLoopContext'
export * from './AutoLoopPageHandlers'
export * from './InfoService'
export * from './MouseService'
export * from './ParanoiaService'
export * from './PageNavigationService'
export * from './StartService'
export * from './TooltipService'