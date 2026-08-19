import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseDelimitedText, parseExcelFile } from '@/features/ingredients/import/parsers'

function fileFromBuffer(buffer: ArrayBuffer, name: string): File {
  return new File([buffer], name)
}

describe('parseDelimitedText (texto pegado y CSV)', () => {
  it('interpreta texto separado por punto y coma', () => {
    const result = parseDelimitedText('Nombre;Unidad;Precio\nTomate;kg;1,80\nCebolla;kg;1,20')
    expect(result.warning).toBeNull()
    expect(result.sheets[0].table.headers).toEqual(['Nombre', 'Unidad', 'Precio'])
    expect(result.sheets[0].table.rows).toEqual([
      ['Tomate', 'kg', '1,80'],
      ['Cebolla', 'kg', '1,20'],
    ])
  })

  it('interpreta texto separado por comas', () => {
    const result = parseDelimitedText('Nombre,Unidad,Precio\nSal,kg,0.60')
    expect(result.sheets[0].table.headers).toEqual(['Nombre', 'Unidad', 'Precio'])
    expect(result.sheets[0].table.rows).toEqual([['Sal', 'kg', '0.60']])
  })

  it('interpreta texto separado por tabulaciones', () => {
    const result = parseDelimitedText('Nombre\tUnidad\tPrecio\nAceite\tl\t4,90')
    expect(result.sheets[0].table.headers).toEqual(['Nombre', 'Unidad', 'Precio'])
    expect(result.sheets[0].table.rows).toEqual([['Aceite', 'l', '4,90']])
  })

  it('ignora líneas completamente vacías', () => {
    const result = parseDelimitedText('Nombre;Unidad;Precio\nTomate;kg;1,80\n\n\nCebolla;kg;1,20')
    expect(result.sheets[0].table.rows).toHaveLength(2)
  })

  it('devuelve warning cuando no hay contenido interpretable', () => {
    const result = parseDelimitedText('   \n   ')
    expect(result.sheets).toHaveLength(0)
    expect(result.warning).not.toBeNull()
  })

  it('respeta comillas con separador embebido (CSV con campos entrecomillados)', () => {
    const result = parseDelimitedText('Nombre,Unidad,Precio\n"Tomate, pera",kg,1.80')
    expect(result.sheets[0].table.rows).toEqual([['Tomate, pera', 'kg', '1.80']])
  })
})

describe('parseExcelFile', () => {
  it('lee un Excel simple con encabezados', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Hoja1')
    sheet.addRow(['Nombre', 'Unidad', 'Precio'])
    sheet.addRow(['Tomate', 'kg', 1.8])
    sheet.addRow(['Cebolla', 'kg', 1.2])
    const buffer = await workbook.xlsx.writeBuffer()

    const result = await parseExcelFile(fileFromBuffer(buffer, 'ingredientes.xlsx'))
    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].table.headers).toEqual(['Nombre', 'Unidad', 'Precio'])
    expect(result.sheets[0].table.rows).toHaveLength(2)
  })

  it('salta filas vacías intermedias', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Hoja1')
    sheet.addRow(['Nombre', 'Unidad', 'Precio'])
    sheet.addRow(['Tomate', 'kg', 1.8])
    sheet.addRow([])
    sheet.addRow(['Cebolla', 'kg', 1.2])
    const buffer = await workbook.xlsx.writeBuffer()

    const result = await parseExcelFile(fileFromBuffer(buffer, 'ingredientes.xlsx'))
    expect(result.sheets[0].table.rows).toHaveLength(2)
  })

  it('detecta varias hojas útiles y las devuelve todas', async () => {
    const workbook = new ExcelJS.Workbook()
    const s1 = workbook.addWorksheet('Verduras')
    s1.addRow(['Nombre', 'Unidad', 'Precio'])
    s1.addRow(['Tomate', 'kg', 1.8])
    const s2 = workbook.addWorksheet('Carnes')
    s2.addRow(['Nombre', 'Unidad', 'Precio'])
    s2.addRow(['Pollo', 'kg', 5.5])
    const buffer = await workbook.xlsx.writeBuffer()

    const result = await parseExcelFile(fileFromBuffer(buffer, 'ingredientes.xlsx'))
    expect(result.sheets.map((s) => s.name)).toEqual(['Verduras', 'Carnes'])
  })

  it('conserva columnas adicionales no reconocidas para que el mapeo decida', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Hoja1')
    sheet.addRow(['Nombre', 'Unidad', 'Precio', 'Proveedor'])
    sheet.addRow(['Tomate', 'kg', 1.8, 'Mercabarna'])
    const buffer = await workbook.xlsx.writeBuffer()

    const result = await parseExcelFile(fileFromBuffer(buffer, 'ingredientes.xlsx'))
    expect(result.sheets[0].table.headers).toEqual(['Nombre', 'Unidad', 'Precio', 'Proveedor'])
    expect(result.sheets[0].table.rows[0]).toEqual(['Tomate', 'kg', '1.8', 'Mercabarna'])
  })
})
