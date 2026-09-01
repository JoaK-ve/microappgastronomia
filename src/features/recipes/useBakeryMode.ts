import { useLocation } from 'react-router-dom'

/**
 * "Panadería" reutiliza las mismas páginas que "Recetas" (lista, alta,
 * ficha) en vez de duplicarlas — el único dato que cambia es si la ruta
 * actual vive bajo /panaderia o /recetas. No es una fuente de verdad de
 * negocio (eso es recipes.is_bakery en la base de datos): esto solo decide
 * por qué puerta entró el usuario, para elegir textos/enlaces/qué sección
 * de ingredientes mostrar.
 */
export function useBakeryMode() {
  return useLocation().pathname.startsWith('/panaderia')
}

export function bakeryBasePath(bakery: boolean) {
  return bakery ? '/panaderia' : '/recetas'
}
