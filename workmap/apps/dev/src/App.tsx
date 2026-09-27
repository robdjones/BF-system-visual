import { useRoute } from './route'
import { Index } from './pages/Index'
import { Story } from './pages/Story'
import { Hero } from './pages/Hero'
import { Play } from './pages/Play'
import { Export } from './pages/Export'
import { Kit } from './pages/Kit'

export function App() {
  const { path, params } = useRoute()
  if (path === '/hero') return <Hero params={params} />
  if (path === '/play') return <Play params={params} />
  if (path === '/export') return <Export params={params} />
  if (path === '/story/kit') return <Kit />
  if (path.startsWith('/story')) return <Story params={params} />
  return <Index />
}
