'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';

export default function LicensePage() {
  return (
    <div className="min-h-screen pt-24 bg-bg-secondary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-orbitron font-bold text-content-primary mb-4">
              Лицензия на{' '}
              <span className="text-poison-green">осуществление деятельности</span>
            </h1>
            <p className="text-lg text-content-secondary leading-relaxed">
              Официальный документ, подтверждающий право на оказание услуг
            </p>
          </div>

          {/* License Card */}
          <CyberpunkCard className="p-8">
            <div className="space-y-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-poison-green/10 rounded-lg flex items-center justify-center">
                  <FileText className="h-8 w-8 text-poison-green" />
                </div>
                <div>
                  <h2 className="text-2xl font-orbitron font-bold text-content-primary">
                    Лицензия
                  </h2>
                  <p className="text-content-muted">
                    №23.КК.08.003.Л.000016.02.25 от 13.02.2025 г.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-bg-secondary rounded-lg border border-gray-200">
                  <div className="text-sm text-content-muted mb-2 leading-relaxed">Номер лицензии</div>
                  <div className="text-lg font-orbitron font-semibold text-content-primary leading-relaxed">
                    №23.КК.08.003.Л.000016.02.25
                  </div>
                </div>

                <div className="p-4 bg-bg-secondary rounded-lg border border-gray-200">
                  <div className="text-sm text-content-muted mb-2 leading-relaxed">Дата выдачи</div>
                  <div className="text-lg font-orbitron font-semibold text-content-primary leading-relaxed">
                    13.02.2025 г.
                  </div>
                </div>

                <div className="p-4 bg-bg-secondary rounded-lg border border-gray-200">
                  <div className="text-sm text-content-muted mb-2 leading-relaxed">Лицензиат</div>
                  <div className="text-lg font-orbitron font-semibold text-content-primary leading-relaxed">
                    ИП Белавина О.В.
                  </div>
                </div>

                <div className="p-4 bg-bg-secondary rounded-lg border border-gray-200">
                  <div className="text-sm text-content-muted mb-2 leading-relaxed">Вид деятельности</div>
                  <div className="text-lg font-medium text-content-primary leading-relaxed">
                    Дезинфекционная деятельность, дезинсекция, дератизация
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="mt-8">
                <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-4 text-center">
                  QR-код лицензии
                </h3>
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg border-2 border-gray-200 shadow-lg">
                    <Image
                      src="/images/qr-code-license.jpeg"
                      alt="QR-код лицензии"
                      width={200}
                      height={200}
                      className="w-auto h-auto"
                      priority
                    />
                  </div>
                </div>
                <p className="text-sm text-content-muted text-center mt-4 leading-relaxed">
                  Отсканируйте QR-код для получения информации о лицензии
                </p>
              </div>
            </div>
          </CyberpunkCard>

          {/* Back Button */}
          <div className="flex justify-center">
            <CyberpunkButton
              href="/"
              variant="outline"
              size="lg"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Вернуться на главную
            </CyberpunkButton>
          </div>
        </motion.div>
      </div>
    </div>
  );
}




