'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border-2 border-poison-green/30">
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-poison-green/10 to-neon-orange/10 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-orbitron font-bold text-content-primary">
                  Политика конфиденциальности
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-content-muted hover:text-content-primary"
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-120px)] px-6 py-6">
                <div className="prose prose-sm max-w-none text-content-secondary leading-relaxed">
                  <p className="mb-4 text-base leading-relaxed">
                    Наша компания, оказывающая услуги дезинфекции, дезинсекции и других услуг, 
                    связанных с данной деятельностью, гарантирует, что адрес, состояние вашего 
                    помещения, объекта, участка и ваши контактные данные не станут известны третьим 
                    лицам без вашего разрешения, в соответствии с законодательством РФ.
                  </p>
                  
                  <p className="mb-4 text-base leading-relaxed">
                    Мы соблюдаем все требования Федерального закона «О персональных данных» 
                    и обеспечиваем полную конфиденциальность информации, полученной от наших клиентов.
                  </p>
                  
                  <p className="mb-4 text-base leading-relaxed">
                    Все данные, предоставленные вами при оформлении заявки, используются 
                    исключительно для связи с вами и выполнения заказанных услуг. Мы не передаем 
                    вашу информацию третьим лицам и не используем ее в коммерческих целях.
                  </p>
                  
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-3">
                      Контакты
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium text-content-primary">Телефон:</span>{' '}
                        <a 
                          href="tel:+79883313332" 
                          className="text-poison-green hover:underline"
                        >
                          8-988-331-33-32
                        </a>
                      </p>
                      <p>
                        <span className="font-medium text-content-primary">Email:</span>{' '}
                        <a 
                          href="mailto:deztexug@yandex.ru" 
                          className="text-poison-green hover:underline"
                        >
                          deztexug@yandex.ru
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-poison-green text-white rounded-lg hover:bg-poison-green/90 transition-colors font-orbitron font-medium"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PrivacyModal;
export { PrivacyModal };

