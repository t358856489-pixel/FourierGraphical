import { createDefaultFunction } from '../core/function'
import { createPlaybackState } from '../core/playback'
import { useDocumentStore } from '../state/documentStore'
import { usePlaybackStore } from '../state/playbackStore'
import { INITIAL_VIEW, useViewStore } from '../state/viewStore'
import { useToastStore } from '../ui/toastStore'

export const resetStores = (): void => {
  useDocumentStore.getState().loadFunction(createDefaultFunction(), false)
  usePlaybackStore.setState(createPlaybackState())
  useViewStore.setState({ ...INITIAL_VIEW, hoveredComponentId: null })
  useToastStore.setState({ messages: [] })
}
