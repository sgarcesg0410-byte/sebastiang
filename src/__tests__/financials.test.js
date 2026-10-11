import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RETABLO_SIZES,
  DEFAULT_RETABLO_COSTS,
  getRetabloSizes,
  calculateRetablosFinancials
} from '../services/api';

describe('Cálculos Financieros de Retablos (Margen, Costo y Ganancia)', () => {
  it('debe tener las dimensiones y precios acordados por defecto para Sebastian G', () => {
    const catalog = getRetabloSizes();

    const expected = {
      '20x30': { cost: 15000, price: 30000, profit: 15000, marginPercent: 50 },
      '30x45': { cost: 30000, price: 60000, profit: 30000, marginPercent: 50 },
      '40x50': { cost: 55000, price: 85000, profit: 30000, marginPercent: 35 },
      '50x70': { cost: 80000, price: 110000, profit: 30000, marginPercent: 27 },
      '70x50': { cost: 80000, price: 120000, profit: 40000, marginPercent: 33 },
      '70x100': { cost: 150000, price: 200000, profit: 50000, marginPercent: 25 },
    };

    catalog.forEach(item => {
      const exp = expected[item.id];
      if (exp) {
        expect(item.cost).toBe(exp.cost);
        expect(item.price).toBe(exp.price);
        expect(item.profit).toBe(exp.profit);
        expect(item.marginPercent).toBe(exp.marginPercent);
      }
    });
  });

  it('debe calcular correctamente los totales financieros para una reserva con múltiples retablos', () => {
    const booking = {
      retabloSizes: {
        '20x30': 2, // 2 * 30.000 = 60.000 venta | 2 * 15.000 = 30.000 costo | ganancia 30.000
        '50x70': 1, // 1 * 110.000 = 110.000 venta | 1 * 80.000 = 80.000 costo | ganancia 30.000
        '70x100': 1 // 1 * 200.000 = 200.000 venta | 1 * 150.000 = 150.000 costo | ganancia 50.000
      }
    };

    const fin = calculateRetablosFinancials(booking);

    expect(fin.count).toBe(4);
    expect(fin.totalSelling).toBe(370000); // 60k + 110k + 200k
    expect(fin.totalCost).toBe(260000); // 30k + 80k + 150k
    expect(fin.netProfit).toBe(110000); // 30k + 30k + 50k
    expect(fin.items.length).toBe(3);
  });

  it('debe respetar costos y precios personalizados de configuración si se proveen', () => {
    const customSettings = {
      retabloCost20x30: 18000,
      printedPhoto20x30Price: 35000
    };

    const booking = {
      retabloSizes: {
        '20x30': 3
      }
    };

    const fin = calculateRetablosFinancials(booking, customSettings);

    expect(fin.count).toBe(3);
    expect(fin.totalSelling).toBe(105000); // 3 * 35.000
    expect(fin.totalCost).toBe(54000); // 3 * 18.000
    expect(fin.netProfit).toBe(51000); // 105k - 54k
  });

  it('debe retornar valores en 0 cuando no hay retablos seleccionados', () => {
    const fin = calculateRetablosFinancials(null);
    expect(fin.totalSelling).toBe(0);
    expect(fin.totalCost).toBe(0);
    expect(fin.netProfit).toBe(0);
    expect(fin.count).toBe(0);
    expect(fin.items).toEqual([]);
  });
});
