import { supabase } from '../lib/supabase';

const checklistItems = [
  { pos: 'Bomba Hidráulica', sys: 'Sistema Hidráulico', desc: 'Mangueiras' },
  { pos: 'Bomba Hidráulica', sys: 'Sistema Hidráulico', desc: 'Vazamentos' },
  { pos: 'Bomba Hidráulica', sys: 'Sistema Hidráulico', desc: 'Ruídos' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Banco do operador/motorista e Cinto de Segurança' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Braço e palheta do limpador parabrisas' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Buzina' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Canopla de câmbio' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Checar diário de bordo do operador' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Cinto de segurança - Passageiros' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Condições dos bancos e do piso' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Escada de acesso' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Espelho retrovisor' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Faixas refletivas' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Farol alto' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Farol baixo' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Folga na alavanca de câmbio' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Funcionamento/acionamento dos pedáis, Mangeiras/cabos obstruindo os pedáis' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Iluminação interna' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Infiltração de poeira e água' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Limpeza e asseio' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Luz de freio' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Luz de placa' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Luz de ré' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Macaco, chave e triângulo' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Parabrisas - riscos e trincas' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Pisca direito' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Pisca esquerdo' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Portas da Cabine, Fechaduras e Saída de Emergência' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Sirene de Ré/Alarme de Deslocamento/Câmera de Ré' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Suporte de bateria' },
  { pos: 'Cabine', sys: 'Cabine', desc: 'Tacógrafo' },
  { pos: 'Freio', sys: 'Freio', desc: 'Freio de estacionamento' },
  { pos: 'Caixa da Bateria', sys: 'Cabine', desc: 'Cabos de bateria, Aterramento e Chave Geral' },
  { pos: 'Caixa da Bateria', sys: 'Cabine', desc: 'Polos Derretidos da Bateria e Limpeza do Compartimento' },
  { pos: 'Chassi', sys: 'Chassi', desc: 'Para-Barro' },
  { pos: 'Chassi', sys: 'Chassi', desc: 'Para-Barro - carreta' },
  { pos: 'Chassi', sys: 'Chassi', desc: 'Pára-choques' },
  { pos: 'Comando Hidráulico', sys: 'Sistema Hidráulico', desc: 'Mangueiras, tubos e vazamentos' },
  { pos: 'Combate Incêndio', sys: 'Combate Incêndio', desc: 'Carga e validade dos extintores de incêndio' },
  { pos: 'Direção/Articulação', sys: 'Direção', desc: 'Mangueiras' },
  { pos: 'Direção/Articulação', sys: 'Direção', desc: 'Trincas/Folgas articulação do chassis' },
  { pos: 'Direção/Articulação', sys: 'Direção', desc: 'Vazamentos' },
  { pos: 'Documentação', sys: 'Cabine', desc: 'Aferição do tacógrafo' },
  { pos: 'Documentação', sys: 'Cabine', desc: 'Carteira de motorista D ou E' },
  { pos: 'Documentação', sys: 'Cabine', desc: 'Licenciamento' },
  { pos: 'Freio', sys: 'Freio', desc: 'Cilindros' },
  { pos: 'Freio', sys: 'Freio', desc: 'Mangueiras' },
  { pos: 'Freio', sys: 'Freio', desc: 'Vazamentos' },
  { pos: 'Freio', sys: 'Freio', desc: 'Lona, flexível e campanas de freio dianteiro' },
  { pos: 'Freio', sys: 'Freio', desc: 'Lona, flexível e campanas de freio traseiro' },
  { pos: 'Freio', sys: 'Freio', desc: 'Vazamento de ar/óleo de freio' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Vazamentos' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Ruídos anormais' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Cano de escape' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Capô do motor diesel' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Chicotes elétricos das laterais do bloco do motor (isolamento)' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Chicotes elétricos do ALTERNADOR (verificar isalamento e sinais de derretimento)' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Chicotes elétricos do MOTOR DE PARTIDA (verificar isalamento e sinais de derretimento)' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Chicotes elétricos que passam por baixo do carter (isolamento)' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Chicotes elétricos que passam por cima do cabeçote (isolamento)' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Compressor ar condicionado' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Correias' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Coxim de fixação do motor' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Emissão de fumaça preta' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Escapamento e Silencioso' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Filtro de ar' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Hélice' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Proteção e Mangueira do radiador de água' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Manta térmica do escapamento, silencioso e turbina' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Nível de óleo do motor' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Radiador água e Ar condicionado (coxins, fixação e vazamentos)' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Radiador óleo' },
  { pos: 'Motor Diesel', sys: 'Motor Diesel', desc: 'Sensores de alarme' },
  { pos: 'Motor Diesel', sys: 'Sistema Hidráulico', desc: 'Vazamentos Mangueira de Lubrificação da Turbina' },
  { pos: 'Pneus', sys: 'Material Rodante', desc: '00 - Realizar APRM Serviços de Borracharia' },
  { pos: 'Pneus', sys: 'Material Rodante', desc: 'Calibragem' },
  { pos: 'Pneus', sys: 'Material Rodante', desc: 'Desgastes' },
  { pos: 'Pneus', sys: 'Material Rodante', desc: 'Pneu sobressalente' },
  { pos: 'Pneus', sys: 'Material Rodante', desc: 'Posição de rodagem' },
  { pos: 'Pneus', sys: 'Material Rodante', desc: 'Rasgos nas Laterais EXTERNAS, INTERNAS e BANDA DE RODAGEM' },
  { pos: 'Tanque Combustível', sys: 'Motor Diesel', desc: 'Verificar mais avarias que não estão no checklist e por como observação' },
  { pos: 'Tanque Combustível', sys: 'Motor Diesel', desc: 'Limpeza' },
  { pos: 'Tanque Combustível', sys: 'Motor Diesel', desc: 'Peneira e respiro' },
  { pos: 'Tanque Combustível', sys: 'Motor Diesel', desc: 'Sensor de nível' },
  { pos: 'Tanque Hidráulico', sys: 'Sistema Hidráulico', desc: 'Mangueiras' },
  { pos: 'Tanque Hidráulico', sys: 'Sistema Hidráulico', desc: 'Nível de óleo' },
  { pos: 'Tanque Hidráulico', sys: 'Sistema Hidráulico', desc: 'Sensores de temperatura' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Mangueiras' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Vazamentos' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Vareta de Nível' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Ruídos anormais' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Chicotes elétricos' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Cardan dianteiro (Cruzetas, parafusos)' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Cardan traseiro (Cruzetas, parafusos)' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Diferencial dianteiro e traseiro' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Prisioneiros/porca de roda' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'D - Caixa de direção' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'D - Mangueiras da caixa de direção' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'D - Terminais barra de direção direito' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'D - Terminais barra de direção esquerdo' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'D - Terminais da caixa de direção' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'T - Cruzetas do cardã' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'T - Cintas de segurança do cardã' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'T - Flange do Cardã' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'T - Vazamento de óleo do diferencial' },
  { pos: 'Transmissão', sys: 'Transmissão', desc: 'Verificar desgaste das cremalheiras' },
];

export async function seedChecklists() {
  const { data: equipments } = await supabase.from('equipments').select('id, name');
  
  if (!equipments) return;

  for (const equipment of equipments) {
    // Verificar se já tem checklist
    const { count } = await supabase
      .from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('equipment_id', equipment.id);

    if (count === 0) {
      console.log(`Seeding checklist for ${equipment.name}...`);
      
      // 1. Tentar inserir direto (Estrutura Simplificada)
      const itemsToInsert = checklistItems.map((item, index) => ({
        equipment_id: equipment.id,
        position: item.pos,
        system: item.sys,
        description: `[${item.pos} | ${item.sys}] ${item.desc}`,
        order_index: index
      }));

      const { error: directError } = await supabase.from('checklist_items').insert(itemsToInsert);
      
      if (directError && directError.message.includes('equipment_id')) {
        console.log('Estrutura simplificada não encontrada, tentando estrutura com tabela intermediária...');
        
        // 2. Tentar estrutura do README (Tabela intermediária 'checklists')
        // Criar ou buscar o checklist pai
        let { data: checklist } = await supabase
          .from('checklists')
          .select('id')
          .eq('equipment_id', equipment.id)
          .eq('name', 'Checklist Geral')
          .single();

        if (!checklist) {
          const { data: newChecklist, error: createError } = await supabase
            .from('checklists')
            .insert({ equipment_id: equipment.id, name: 'Checklist Geral' })
            .select()
            .single();
          
          if (createError) {
            console.error('Erro ao criar checklist pai:', createError.message);
            continue;
          }
          checklist = newChecklist;
        }

        if (checklist) {
          const itemsWithChecklistId = checklistItems.map((item) => ({
            checklist_id: checklist.id,
            description: `[${item.pos} | ${item.sys}] ${item.desc}`
          }));
          await supabase.from('checklist_items').insert(itemsWithChecklistId);
        }
      } else if (directError) {
        // Outro erro (colunas novas), tentar modo compatibilidade simplificado
        const basicItems = checklistItems.map((item) => ({
          equipment_id: equipment.id,
          description: `[${item.pos} | ${item.sys}] ${item.desc}`
        }));
        await supabase.from('checklist_items').insert(basicItems);
      }
    }
  }
}

export async function seedInitialEquipments() {
  const initialEquipments = [
    {
      name: 'CAMINHÃO TRATOR DAF 510 6X2',
      model: 'DAF 510 6X2',
      serial_number: 'DAF-001',
      description: 'Caminhão Trator para transporte de biomassa',
      preventive_interval_days: 30,
      version: 1
    },
    {
      name: 'CAMINHÃO MERCEDEZ BENS MB2644',
      model: 'MB2644',
      serial_number: 'MB-001',
      description: 'Caminhão Mercedes Bens para operações florestais',
      preventive_interval_days: 30,
      version: 1
    }
  ];

  for (const eq of initialEquipments) {
    const { data: existing } = await supabase
      .from('equipments')
      .select('id')
      .eq('name', eq.name)
      .single();

    if (!existing) {
      await supabase.from('equipments').insert(eq);
    }
  }
}
