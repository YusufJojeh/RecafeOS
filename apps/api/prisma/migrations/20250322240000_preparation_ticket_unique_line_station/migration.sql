-- At most one prep ticket per order line per station (concurrent send-to-prep safety).
CREATE UNIQUE INDEX "PreparationTicket_orderId_orderItemId_station_key" ON "PreparationTicket"("orderId", "orderItemId", "station");
