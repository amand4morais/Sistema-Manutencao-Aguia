# Águia Florestal - Sistema de Manutenção

## Etapa 1: Arquitetura e Base do Sistema

### 1. Stack Tecnológica
Para este projeto, escolhemos uma stack moderna e robusta que prioriza a agilidade no desenvolvimento e a facilidade de manutenção:

*   **Frontend:** React (Vite) com TypeScript.
*   **Estilização:** Tailwind CSS (Mobile-first, focado em tablets).
*   **Backend/BaaS:** Supabase (PostgreSQL, Auth, Storage e Realtime).
*   **Gerenciamento de Estado/Cache:** TanStack Query (React Query) - Essencial para lidar com o cache e funcionamento offline parcial.
*   **Ícones:** Lucide React.
*   **Animações:** Motion (Framer Motion).
*   **Roteamento:** React Router DOM.

### 2. Arquitetura do Sistema

*   **Frontend:** Uma Single Page Application (SPA) responsiva. Utilizaremos o padrão de componentes funcionais e hooks customizados para separar a lógica de negócio da interface.
*   **Autenticação:** Utilizaremos o Supabase Auth. O login será baseado em CPF (armazenado como metadado ou em uma tabela de perfis) e senha.
*   **Banco de Dados:** PostgreSQL hospedado no Supabase. Utilizaremos RLS (Row Level Security) para garantir que funcionários não acessem dados administrativos.
*   **Armazenamento (Storage):** Supabase Storage para os manuais de equipamentos (PDFs e imagens).
*   **Offline/Sincronização:** Para o uso "na mata", utilizaremos o cache do React Query. Futuramente (Etapa 3), implementaremos uma fila de sincronização no `localStorage` para salvar manutenções quando não houver sinal.

### 3. Modelo de Banco de Dados (SQL Supabase)

```sql
-- Tabela de Perfis (Extensão do auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  cpf TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'employee')) DEFAULT 'employee',
  must_change_password BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Equipamentos
CREATE TABLE equipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  model TEXT,
  serial_number TEXT UNIQUE,
  preventive_interval_days INTEGER NOT NULL, -- Ex: 30 para mensal
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Manuais
CREATE TABLE manuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES equipments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Checklists (Modelos)
CREATE TABLE checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES equipments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itens do Checklist
CREATE TABLE checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manutenções Preventivas (Execução)
CREATE TABLE preventive_maintenances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES equipments(id),
  responsible_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  general_observation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Respostas do Checklist por Manutenção
CREATE TABLE preventive_maintenance_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_id UUID REFERENCES preventive_maintenances(id) ON DELETE CASCADE,
  item_id UUID REFERENCES checklist_items(id),
  status TEXT CHECK (status IN ('ok', 'fail', 'not_applicable')),
  observation TEXT
);

-- Manutenções Corretivas
CREATE TABLE corrective_maintenances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES equipments(id),
  responsible_id UUID REFERENCES profiles(id),
  problem_description TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notificações
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de Atividades
CREATE TABLE activity_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Diagrama Lógico (Resumo)
*   **Profiles** (1:N) **Maintenances** (Preventivas e Corretivas)
*   **Equipments** (1:N) **Manuals**
*   **Equipments** (1:N) **Checklists**
*   **Checklists** (1:N) **Checklist_Items**
*   **Preventive_Maintenances** (1:N) **Preventive_Maintenance_Items**

### 5. Estrutura de Pastas
```text
/src
  /assets          # Imagens e ícones estáticos
  /components      # Componentes reutilizáveis (Button, Input, Card)
    /ui            # Componentes básicos de interface
    /layout        # Sidebar, Header, Container
  /hooks           # Hooks customizados (useAuth, useOffline)
  /lib             # Configurações de bibliotecas (supabase.ts)
  /pages           # Páginas da aplicação (Login, Dashboard, Profile)
    /admin         # Páginas restritas ao administrador
    /employee      # Páginas de uso do funcionário
  /services        # Chamadas à API/Supabase
  /types           # Definições de tipos TypeScript
  /utils           # Funções utilitárias (validação de CPF, formatação de data)
  App.tsx          # Componente raiz com rotas
  main.tsx         # Ponto de entrada
  index.css        # Estilos globais (Tailwind)
```

### 6. Como Iniciar o Projeto Localmente
1.  Clone o repositório.
2.  Execute `npm install` para instalar as dependências.
3.  Configure as variáveis de ambiente no arquivo `.env` (SUPABASE_URL e SUPABASE_ANON_KEY).
4.  Execute `npm run dev` para iniciar o servidor de desenvolvimento.
5.  Acesse `http://localhost:3000`.
