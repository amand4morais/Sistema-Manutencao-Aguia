import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
      default: return <Info className="w-5 h-5 text-sky-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 transition-all rounded-xl",
          isOpen ? "bg-stone-200 text-stone-900" : "text-stone-700 hover:text-stone-900 hover:bg-stone-200"
        )}
      >
        <Bell className={cn("w-6 h-6", isOpen && "fill-stone-900")} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-96 bg-white border border-stone-200 rounded-2xl shadow-2xl z-[100] overflow-hidden"
          >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="text-sm font-bold text-stone-900">Notificações</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-stone-200" />
                  </div>
                  <p className="text-stone-400 text-sm">Nenhuma notificação por enquanto.</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-50">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 transition-colors hover:bg-stone-50 relative group",
                        !notification.read && "bg-emerald-50/30"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 shrink-0">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm font-semibold leading-tight mb-1",
                              notification.read ? "text-stone-600" : "text-stone-900"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-emerald-600 transition-all"
                                title="Marcar como lida"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 line-clamp-2 mb-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-stone-400">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: ptBR
                              })}
                            </span>
                            {notification.link && (
                              <Link
                                to={notification.link}
                                onClick={() => {
                                  setIsOpen(false);
                                  markAsRead(notification.id);
                                }}
                                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
                              >
                                Ver detalhes
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 bg-stone-50 text-center border-t border-stone-100">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-stone-400 hover:text-stone-600 uppercase tracking-widest"
                >
                  Fechar
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
