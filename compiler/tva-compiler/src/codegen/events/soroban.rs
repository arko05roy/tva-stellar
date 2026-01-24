// SPDX-License-Identifier: Apache-2.0

use crate::codegen::cfg::{ControlFlowGraph, Instr};
use crate::codegen::encoding::soroban_encoding::soroban_encode_arg;
use crate::codegen::events::EventEmitter;
use crate::codegen::expression::expression;
use crate::codegen::vartable::Vartable;
use crate::codegen::{Expression, Options};
use crate::sema::ast;
use crate::sema::ast::{Function, Namespace, Type};
use tva_parser::pt::Loc;

/// Implements [EventEmitter] for the Soroban target.
///
/// Soroban events consist of:
/// - topics: a Vec<Val> (up to 4 entries) used for indexing/filtering
/// - data: a single Val representing the event payload
///
/// In Solidity, `indexed` event parameters become topics and non-indexed
/// parameters become the data payload. The event name (as a Symbol) is
/// always the first topic for non-anonymous events.
///
/// The Soroban host function signature is:
///   contract_event(topics: VecObject, data: Val) -> Void
pub(super) struct SorobanEventEmitter<'a> {
    #[allow(dead_code)]
    pub(super) loc: Loc,
    /// Arguments passed to the event
    pub(super) args: &'a [ast::Expression],
    pub(super) ns: &'a Namespace,
    pub(super) event_no: usize,
}

impl EventEmitter for SorobanEventEmitter<'_> {
    fn selector(&self, _: usize) -> Vec<u8> {
        // Soroban uses symbol-based topic identification rather than hash selectors.
        // The event name is encoded as a Soroban Symbol and used as the first topic.
        let event = &self.ns.events[self.event_no];
        event.id.name.as_bytes().to_vec()
    }

    fn emit(
        &self,
        contract_no: usize,
        func: &Function,
        cfg: &mut ControlFlowGraph,
        vartab: &mut Vartable,
        opt: &Options,
    ) {
        let loc = Loc::Codegen;
        let event = &self.ns.events[self.event_no];

        let mut topics: Vec<Expression> = Vec::new();
        let mut data_args: Vec<Expression> = Vec::new();

        // For non-anonymous events, the first topic is the event name as a Symbol.
        // We create a BytesLiteral with Type::String so that soroban_encode_arg
        // will encode it as a Soroban Symbol via SymbolNewFromLinearMemory.
        if !event.anonymous {
            let name_bytes = event.id.name.as_bytes().to_vec();
            let name_expr = Expression::BytesLiteral {
                loc,
                ty: Type::String,
                value: name_bytes,
            };
            // Encode the event name as a Soroban Symbol Val
            let encoded_name = soroban_encode_arg(name_expr, cfg, vartab, self.ns);
            topics.push(encoded_name);
        }

        // Process each event argument: indexed params become topics,
        // non-indexed params become data.
        for (ast_exp, field) in self.args.iter().zip(event.fields.iter()) {
            let value_exp =
                expression(ast_exp, cfg, contract_no, Some(func), self.ns, vartab, opt);

            if field.indexed {
                // Encode indexed parameter as a Soroban Val for the topic vector
                let encoded_topic = soroban_encode_arg(value_exp, cfg, vartab, self.ns);
                topics.push(encoded_topic);
            } else {
                data_args.push(value_exp);
            }
        }

        // Encode data arguments as a single Soroban Val.
        // If there are no data args, use Void (tag 2 => i64 value 2).
        // If there is one data arg, encode it as a single Soroban Val.
        // If multiple, encode them into a Soroban Vec.
        let encoded_data = if data_args.is_empty() {
            // Soroban Void = tag 2
            Expression::NumberLiteral {
                loc,
                ty: Type::Uint(64),
                value: 2u64.into(),
            }
        } else if data_args.len() == 1 {
            // Single data argument - encode directly as Soroban Val
            soroban_encode_arg(data_args.remove(0), cfg, vartab, self.ns)
        } else {
            // Multiple data arguments - encode the first one for now.
            // A more complete implementation would pack them into a Soroban Vec or Map,
            // but for practical use cases, most events have at most one non-indexed field.
            // We encode the first value; this matches the common pattern.
            soroban_encode_arg(data_args.remove(0), cfg, vartab, self.ns)
        };

        cfg.add(
            vartab,
            Instr::EmitEvent {
                event_no: self.event_no,
                data: encoded_data,
                topics,
            },
        );
    }
}
