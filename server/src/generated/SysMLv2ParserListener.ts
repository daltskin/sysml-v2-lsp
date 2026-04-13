
import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


import { OwnedExpressionContext } from "./SysMLv2Parser.js";
import { TypeReferenceContext } from "./SysMLv2Parser.js";
import { SequenceExpressionListContext } from "./SysMLv2Parser.js";
import { BaseExpressionContext } from "./SysMLv2Parser.js";
import { NullExpressionContext } from "./SysMLv2Parser.js";
import { FeatureReferenceExpressionContext } from "./SysMLv2Parser.js";
import { ConstructorExpressionContext } from "./SysMLv2Parser.js";
import { BodyExpressionContext } from "./SysMLv2Parser.js";
import { ArgumentListContext } from "./SysMLv2Parser.js";
import { PositionalArgumentListContext } from "./SysMLv2Parser.js";
import { NamedArgumentListContext } from "./SysMLv2Parser.js";
import { NamedArgumentContext } from "./SysMLv2Parser.js";
import { LiteralExpressionContext } from "./SysMLv2Parser.js";
import { LiteralBooleanContext } from "./SysMLv2Parser.js";
import { LiteralStringContext } from "./SysMLv2Parser.js";
import { LiteralIntegerContext } from "./SysMLv2Parser.js";
import { LiteralRealContext } from "./SysMLv2Parser.js";
import { LiteralInfinityContext } from "./SysMLv2Parser.js";
import { ArgumentMemberContext } from "./SysMLv2Parser.js";
import { ArgumentExpressionMemberContext } from "./SysMLv2Parser.js";
import { NameContext } from "./SysMLv2Parser.js";
import { UnreservedKeywordContext } from "./SysMLv2Parser.js";
import { IdentificationContext } from "./SysMLv2Parser.js";
import { RelationshipBodyContext } from "./SysMLv2Parser.js";
import { RelationshipOwnedElementContext } from "./SysMLv2Parser.js";
import { OwnedRelatedElementContext } from "./SysMLv2Parser.js";
import { DependencyContext } from "./SysMLv2Parser.js";
import { AnnotationContext } from "./SysMLv2Parser.js";
import { OwnedAnnotationContext } from "./SysMLv2Parser.js";
import { AnnotatingElementContext } from "./SysMLv2Parser.js";
import { CommentContext } from "./SysMLv2Parser.js";
import { DocumentationContext } from "./SysMLv2Parser.js";
import { TextualRepresentationContext } from "./SysMLv2Parser.js";
import { RootNamespaceContext } from "./SysMLv2Parser.js";
import { NamespaceContext } from "./SysMLv2Parser.js";
import { NamespaceDeclarationContext } from "./SysMLv2Parser.js";
import { NamespaceBodyContext } from "./SysMLv2Parser.js";
import { NamespaceBodyElementContext } from "./SysMLv2Parser.js";
import { MemberPrefixContext } from "./SysMLv2Parser.js";
import { VisibilityIndicatorContext } from "./SysMLv2Parser.js";
import { NamespaceMemberContext } from "./SysMLv2Parser.js";
import { NonFeatureMemberContext } from "./SysMLv2Parser.js";
import { NamespaceFeatureMemberContext } from "./SysMLv2Parser.js";
import { AliasMemberContext } from "./SysMLv2Parser.js";
import { QualifiedNameContext } from "./SysMLv2Parser.js";
import { ImportRuleContext } from "./SysMLv2Parser.js";
import { ImportDeclarationContext } from "./SysMLv2Parser.js";
import { MembershipImportContext } from "./SysMLv2Parser.js";
import { NamespaceImportContext } from "./SysMLv2Parser.js";
import { FilterPackageContext } from "./SysMLv2Parser.js";
import { FilterPackageMemberContext } from "./SysMLv2Parser.js";
import { MemberElementContext } from "./SysMLv2Parser.js";
import { NonFeatureElementContext } from "./SysMLv2Parser.js";
import { FeatureElementContext } from "./SysMLv2Parser.js";
import { TypeContext } from "./SysMLv2Parser.js";
import { TypePrefixContext } from "./SysMLv2Parser.js";
import { TypeDeclarationContext } from "./SysMLv2Parser.js";
import { SpecializationPartContext } from "./SysMLv2Parser.js";
import { ConjugationPartContext } from "./SysMLv2Parser.js";
import { TypeRelationshipPartContext } from "./SysMLv2Parser.js";
import { DisjoiningPartContext } from "./SysMLv2Parser.js";
import { UnioningPartContext } from "./SysMLv2Parser.js";
import { IntersectingPartContext } from "./SysMLv2Parser.js";
import { DifferencingPartContext } from "./SysMLv2Parser.js";
import { TypeBodyContext } from "./SysMLv2Parser.js";
import { TypeBodyElementContext } from "./SysMLv2Parser.js";
import { SpecializationContext } from "./SysMLv2Parser.js";
import { OwnedSpecializationContext } from "./SysMLv2Parser.js";
import { SpecificTypeContext } from "./SysMLv2Parser.js";
import { GeneralTypeContext } from "./SysMLv2Parser.js";
import { ConjugationContext } from "./SysMLv2Parser.js";
import { OwnedConjugationContext } from "./SysMLv2Parser.js";
import { DisjoiningContext } from "./SysMLv2Parser.js";
import { OwnedDisjoiningContext } from "./SysMLv2Parser.js";
import { UnioningContext } from "./SysMLv2Parser.js";
import { IntersectingContext } from "./SysMLv2Parser.js";
import { DifferencingContext } from "./SysMLv2Parser.js";
import { FeatureMemberContext } from "./SysMLv2Parser.js";
import { TypeFeatureMemberContext } from "./SysMLv2Parser.js";
import { OwnedFeatureMemberContext } from "./SysMLv2Parser.js";
import { ClassifierContext } from "./SysMLv2Parser.js";
import { ClassifierDeclarationContext } from "./SysMLv2Parser.js";
import { SuperclassingPartContext } from "./SysMLv2Parser.js";
import { SubclassificationContext } from "./SysMLv2Parser.js";
import { OwnedSubclassificationContext } from "./SysMLv2Parser.js";
import { FeatureContext } from "./SysMLv2Parser.js";
import { EndFeaturePrefixContext } from "./SysMLv2Parser.js";
import { BasicFeaturePrefixContext } from "./SysMLv2Parser.js";
import { FeaturePrefixContext } from "./SysMLv2Parser.js";
import { OwnedCrossFeatureMemberContext } from "./SysMLv2Parser.js";
import { OwnedCrossFeatureContext } from "./SysMLv2Parser.js";
import { FeatureDirectionContext } from "./SysMLv2Parser.js";
import { FeatureDeclarationContext } from "./SysMLv2Parser.js";
import { FeatureIdentificationContext } from "./SysMLv2Parser.js";
import { FeatureRelationshipPartContext } from "./SysMLv2Parser.js";
import { ChainingPartContext } from "./SysMLv2Parser.js";
import { InvertingPartContext } from "./SysMLv2Parser.js";
import { TypeFeaturingPartContext } from "./SysMLv2Parser.js";
import { FeatureSpecializationPartContext } from "./SysMLv2Parser.js";
import { MultiplicityPartContext } from "./SysMLv2Parser.js";
import { FeatureSpecializationContext } from "./SysMLv2Parser.js";
import { TypingsContext } from "./SysMLv2Parser.js";
import { TypedByContext } from "./SysMLv2Parser.js";
import { SubsettingsContext } from "./SysMLv2Parser.js";
import { SubsetsContext } from "./SysMLv2Parser.js";
import { ReferencesContext } from "./SysMLv2Parser.js";
import { CrossesContext } from "./SysMLv2Parser.js";
import { RedefinitionsContext } from "./SysMLv2Parser.js";
import { RedefinesContext } from "./SysMLv2Parser.js";
import { FeatureTypingContext } from "./SysMLv2Parser.js";
import { OwnedFeatureTypingContext } from "./SysMLv2Parser.js";
import { SubsettingContext } from "./SysMLv2Parser.js";
import { OwnedSubsettingContext } from "./SysMLv2Parser.js";
import { OwnedReferenceSubsettingContext } from "./SysMLv2Parser.js";
import { OwnedCrossSubsettingContext } from "./SysMLv2Parser.js";
import { RedefinitionContext } from "./SysMLv2Parser.js";
import { OwnedRedefinitionContext } from "./SysMLv2Parser.js";
import { FeatureInvertingContext } from "./SysMLv2Parser.js";
import { OwnedFeatureInvertingContext } from "./SysMLv2Parser.js";
import { TypeFeaturingContext } from "./SysMLv2Parser.js";
import { OwnedTypeFeaturingContext } from "./SysMLv2Parser.js";
import { DataTypeContext } from "./SysMLv2Parser.js";
import { ClassContext } from "./SysMLv2Parser.js";
import { StructureContext } from "./SysMLv2Parser.js";
import { AssociationContext } from "./SysMLv2Parser.js";
import { AssociationStructureContext } from "./SysMLv2Parser.js";
import { ConnectorContext } from "./SysMLv2Parser.js";
import { ConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { BinaryConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { NaryConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { ConnectorEndMemberContext } from "./SysMLv2Parser.js";
import { ConnectorEndContext } from "./SysMLv2Parser.js";
import { OwnedCrossMultiplicityMemberContext } from "./SysMLv2Parser.js";
import { OwnedCrossMultiplicityContext } from "./SysMLv2Parser.js";
import { BindingConnectorContext } from "./SysMLv2Parser.js";
import { BindingConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { SuccessionContext } from "./SysMLv2Parser.js";
import { SuccessionDeclarationContext } from "./SysMLv2Parser.js";
import { BehaviorContext } from "./SysMLv2Parser.js";
import { StepContext } from "./SysMLv2Parser.js";
import { FunctionContext } from "./SysMLv2Parser.js";
import { FunctionBodyContext } from "./SysMLv2Parser.js";
import { FunctionBodyPartContext } from "./SysMLv2Parser.js";
import { ReturnFeatureMemberContext } from "./SysMLv2Parser.js";
import { ResultExpressionMemberContext } from "./SysMLv2Parser.js";
import { ExpressionContext } from "./SysMLv2Parser.js";
import { PredicateContext } from "./SysMLv2Parser.js";
import { BooleanExpressionContext } from "./SysMLv2Parser.js";
import { InvariantContext } from "./SysMLv2Parser.js";
import { FeatureChainMemberContext } from "./SysMLv2Parser.js";
import { InteractionContext } from "./SysMLv2Parser.js";
import { FlowContext } from "./SysMLv2Parser.js";
import { SuccessionFlowContext } from "./SysMLv2Parser.js";
import { FlowDeclarationContext } from "./SysMLv2Parser.js";
import { PayloadFeatureMemberContext } from "./SysMLv2Parser.js";
import { PayloadFeatureContext } from "./SysMLv2Parser.js";
import { PayloadFeatureSpecializationPartContext } from "./SysMLv2Parser.js";
import { FlowEndMemberContext } from "./SysMLv2Parser.js";
import { FlowEndContext } from "./SysMLv2Parser.js";
import { ValuePartContext } from "./SysMLv2Parser.js";
import { FeatureValueContext } from "./SysMLv2Parser.js";
import { MultiplicityContext } from "./SysMLv2Parser.js";
import { MultiplicitySubsetContext } from "./SysMLv2Parser.js";
import { MultiplicityRangeContext } from "./SysMLv2Parser.js";
import { OwnedMultiplicityContext } from "./SysMLv2Parser.js";
import { OwnedMultiplicityRangeContext } from "./SysMLv2Parser.js";
import { MultiplicityBoundsContext } from "./SysMLv2Parser.js";
import { MultiplicityExpressionMemberContext } from "./SysMLv2Parser.js";
import { MetaclassContext } from "./SysMLv2Parser.js";
import { PrefixMetadataAnnotationContext } from "./SysMLv2Parser.js";
import { PrefixMetadataMemberContext } from "./SysMLv2Parser.js";
import { PrefixMetadataFeatureContext } from "./SysMLv2Parser.js";
import { MetadataFeatureContext } from "./SysMLv2Parser.js";
import { MetadataFeatureDeclarationContext } from "./SysMLv2Parser.js";
import { MetadataBodyContext } from "./SysMLv2Parser.js";
import { MetadataBodyElementContext } from "./SysMLv2Parser.js";
import { MetadataBodyFeatureMemberContext } from "./SysMLv2Parser.js";
import { MetadataBodyFeatureContext } from "./SysMLv2Parser.js";
import { PackageContext } from "./SysMLv2Parser.js";
import { LibraryPackageContext } from "./SysMLv2Parser.js";
import { PackageDeclarationContext } from "./SysMLv2Parser.js";
import { PackageBodyContext } from "./SysMLv2Parser.js";
import { ElementFilterMemberContext } from "./SysMLv2Parser.js";
import { DependencyDeclarationContext } from "./SysMLv2Parser.js";
import { AnnotatingMemberContext } from "./SysMLv2Parser.js";
import { PackageBodyElementContext } from "./SysMLv2Parser.js";
import { PackageMemberContext } from "./SysMLv2Parser.js";
import { DefinitionElementContext } from "./SysMLv2Parser.js";
import { UsageElementContext } from "./SysMLv2Parser.js";
import { BasicDefinitionPrefixContext } from "./SysMLv2Parser.js";
import { DefinitionExtensionKeywordContext } from "./SysMLv2Parser.js";
import { DefinitionPrefixContext } from "./SysMLv2Parser.js";
import { DefinitionContext } from "./SysMLv2Parser.js";
import { DefinitionDeclarationContext } from "./SysMLv2Parser.js";
import { DefinitionBodyContext } from "./SysMLv2Parser.js";
import { DefinitionBodyItemContext } from "./SysMLv2Parser.js";
import { DefinitionBodyItemContentContext } from "./SysMLv2Parser.js";
import { DefinitionMemberContext } from "./SysMLv2Parser.js";
import { VariantUsageMemberContext } from "./SysMLv2Parser.js";
import { NonOccurrenceUsageMemberContext } from "./SysMLv2Parser.js";
import { StructureUsageMemberContext } from "./SysMLv2Parser.js";
import { BehaviorUsageMemberContext } from "./SysMLv2Parser.js";
import { RefPrefixContext } from "./SysMLv2Parser.js";
import { BasicUsagePrefixContext } from "./SysMLv2Parser.js";
import { EndUsagePrefixContext } from "./SysMLv2Parser.js";
import { UsageExtensionKeywordContext } from "./SysMLv2Parser.js";
import { UnextendedUsagePrefixContext } from "./SysMLv2Parser.js";
import { UsagePrefixContext } from "./SysMLv2Parser.js";
import { UsageContext } from "./SysMLv2Parser.js";
import { UsageDeclarationContext } from "./SysMLv2Parser.js";
import { UsageCompletionContext } from "./SysMLv2Parser.js";
import { UsageBodyContext } from "./SysMLv2Parser.js";
import { DefaultReferenceUsageContext } from "./SysMLv2Parser.js";
import { ReferenceUsageContext } from "./SysMLv2Parser.js";
import { EndFeatureUsageContext } from "./SysMLv2Parser.js";
import { VariantReferenceContext } from "./SysMLv2Parser.js";
import { NonOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { EndOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { OccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { StructureUsageElementContext } from "./SysMLv2Parser.js";
import { BehaviorUsageElementContext } from "./SysMLv2Parser.js";
import { VariantUsageElementContext } from "./SysMLv2Parser.js";
import { SubclassificationPartContext } from "./SysMLv2Parser.js";
import { AttributeDefinitionContext } from "./SysMLv2Parser.js";
import { AttributeUsageContext } from "./SysMLv2Parser.js";
import { EnumerationDefinitionContext } from "./SysMLv2Parser.js";
import { EnumerationBodyContext } from "./SysMLv2Parser.js";
import { EnumerationUsageMemberContext } from "./SysMLv2Parser.js";
import { EnumeratedValueContext } from "./SysMLv2Parser.js";
import { EnumerationUsageContext } from "./SysMLv2Parser.js";
import { OccurrenceDefinitionPrefixContext } from "./SysMLv2Parser.js";
import { OccurrenceDefinitionContext } from "./SysMLv2Parser.js";
import { IndividualDefinitionContext } from "./SysMLv2Parser.js";
import { EmptyMultiplicityMemberContext } from "./SysMLv2Parser.js";
import { OccurrenceUsagePrefixContext } from "./SysMLv2Parser.js";
import { OccurrenceUsageContext } from "./SysMLv2Parser.js";
import { IndividualUsageContext } from "./SysMLv2Parser.js";
import { PortionUsageContext } from "./SysMLv2Parser.js";
import { PortionKindContext } from "./SysMLv2Parser.js";
import { EventOccurrenceUsageContext } from "./SysMLv2Parser.js";
import { SourceSuccessionMemberContext } from "./SysMLv2Parser.js";
import { SourceSuccessionContext } from "./SysMLv2Parser.js";
import { SourceEndMemberContext } from "./SysMLv2Parser.js";
import { SourceEndContext } from "./SysMLv2Parser.js";
import { ItemDefinitionContext } from "./SysMLv2Parser.js";
import { ItemUsageContext } from "./SysMLv2Parser.js";
import { PartDefinitionContext } from "./SysMLv2Parser.js";
import { PartUsageContext } from "./SysMLv2Parser.js";
import { PortDefinitionContext } from "./SysMLv2Parser.js";
import { ConjugatedPortDefinitionMemberContext } from "./SysMLv2Parser.js";
import { ConjugatedPortDefinitionContext } from "./SysMLv2Parser.js";
import { PortUsageContext } from "./SysMLv2Parser.js";
import { ConjugatedPortTypingContext } from "./SysMLv2Parser.js";
import { ConnectionDefinitionContext } from "./SysMLv2Parser.js";
import { ConnectionUsageContext } from "./SysMLv2Parser.js";
import { ConnectorPartContext } from "./SysMLv2Parser.js";
import { BinaryConnectorPartContext } from "./SysMLv2Parser.js";
import { NaryConnectorPartContext } from "./SysMLv2Parser.js";
import { BindingConnectorAsUsageContext } from "./SysMLv2Parser.js";
import { SuccessionAsUsageContext } from "./SysMLv2Parser.js";
import { InterfaceDefinitionContext } from "./SysMLv2Parser.js";
import { InterfaceBodyContext } from "./SysMLv2Parser.js";
import { InterfaceBodyItemContext } from "./SysMLv2Parser.js";
import { InterfaceNonOccurrenceUsageMemberContext } from "./SysMLv2Parser.js";
import { InterfaceNonOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { InterfaceOccurrenceUsageMemberContext } from "./SysMLv2Parser.js";
import { InterfaceOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { DefaultInterfaceEndContext } from "./SysMLv2Parser.js";
import { InterfaceUsageContext } from "./SysMLv2Parser.js";
import { InterfaceUsageDeclarationContext } from "./SysMLv2Parser.js";
import { InterfacePartContext } from "./SysMLv2Parser.js";
import { BinaryInterfacePartContext } from "./SysMLv2Parser.js";
import { NaryInterfacePartContext } from "./SysMLv2Parser.js";
import { InterfaceEndMemberContext } from "./SysMLv2Parser.js";
import { InterfaceEndContext } from "./SysMLv2Parser.js";
import { AllocationDefinitionContext } from "./SysMLv2Parser.js";
import { AllocationUsageContext } from "./SysMLv2Parser.js";
import { AllocationUsageDeclarationContext } from "./SysMLv2Parser.js";
import { FlowDefinitionContext } from "./SysMLv2Parser.js";
import { MessageContext } from "./SysMLv2Parser.js";
import { MessageDeclarationContext } from "./SysMLv2Parser.js";
import { MessageEventMemberContext } from "./SysMLv2Parser.js";
import { MessageEventContext } from "./SysMLv2Parser.js";
import { FlowUsageContext } from "./SysMLv2Parser.js";
import { SuccessionFlowUsageContext } from "./SysMLv2Parser.js";
import { FlowPayloadFeatureMemberContext } from "./SysMLv2Parser.js";
import { FlowPayloadFeatureContext } from "./SysMLv2Parser.js";
import { ActionDefinitionContext } from "./SysMLv2Parser.js";
import { ActionBodyContext } from "./SysMLv2Parser.js";
import { ActionBodyItemContext } from "./SysMLv2Parser.js";
import { NonBehaviorBodyItemContext } from "./SysMLv2Parser.js";
import { ActionBehaviorMemberContext } from "./SysMLv2Parser.js";
import { InitialNodeMemberContext } from "./SysMLv2Parser.js";
import { ActionNodeMemberContext } from "./SysMLv2Parser.js";
import { ActionTargetSuccessionMemberContext } from "./SysMLv2Parser.js";
import { GuardedSuccessionMemberContext } from "./SysMLv2Parser.js";
import { ActionUsageContext } from "./SysMLv2Parser.js";
import { ActionUsageDeclarationContext } from "./SysMLv2Parser.js";
import { PerformActionUsageContext } from "./SysMLv2Parser.js";
import { PerformActionUsageDeclarationContext } from "./SysMLv2Parser.js";
import { ActionNodeContext } from "./SysMLv2Parser.js";
import { ActionNodeUsageDeclarationContext } from "./SysMLv2Parser.js";
import { ActionNodePrefixContext } from "./SysMLv2Parser.js";
import { ControlNodeContext } from "./SysMLv2Parser.js";
import { ControlNodePrefixContext } from "./SysMLv2Parser.js";
import { MergeNodeContext } from "./SysMLv2Parser.js";
import { DecisionNodeContext } from "./SysMLv2Parser.js";
import { JoinNodeContext } from "./SysMLv2Parser.js";
import { ForkNodeContext } from "./SysMLv2Parser.js";
import { AcceptNodeContext } from "./SysMLv2Parser.js";
import { AcceptNodeDeclarationContext } from "./SysMLv2Parser.js";
import { AcceptParameterPartContext } from "./SysMLv2Parser.js";
import { PayloadParameterMemberContext } from "./SysMLv2Parser.js";
import { PayloadParameterContext } from "./SysMLv2Parser.js";
import { TriggerValuePartContext } from "./SysMLv2Parser.js";
import { TriggerFeatureValueContext } from "./SysMLv2Parser.js";
import { TriggerExpressionContext } from "./SysMLv2Parser.js";
import { SendNodeContext } from "./SysMLv2Parser.js";
import { SendNodeDeclarationContext } from "./SysMLv2Parser.js";
import { SenderReceiverPartContext } from "./SysMLv2Parser.js";
import { NodeParameterMemberContext } from "./SysMLv2Parser.js";
import { NodeParameterContext } from "./SysMLv2Parser.js";
import { FeatureBindingContext } from "./SysMLv2Parser.js";
import { EmptyParameterMemberContext } from "./SysMLv2Parser.js";
import { AssignmentNodeContext } from "./SysMLv2Parser.js";
import { AssignmentNodeDeclarationContext } from "./SysMLv2Parser.js";
import { AssignmentTargetMemberContext } from "./SysMLv2Parser.js";
import { AssignmentTargetParameterContext } from "./SysMLv2Parser.js";
import { AssignmentTargetBindingContext } from "./SysMLv2Parser.js";
import { TerminateNodeContext } from "./SysMLv2Parser.js";
import { IfNodeContext } from "./SysMLv2Parser.js";
import { ExpressionParameterMemberContext } from "./SysMLv2Parser.js";
import { ActionBodyParameterMemberContext } from "./SysMLv2Parser.js";
import { ActionBodyParameterContext } from "./SysMLv2Parser.js";
import { IfNodeParameterMemberContext } from "./SysMLv2Parser.js";
import { WhileLoopNodeContext } from "./SysMLv2Parser.js";
import { ForLoopNodeContext } from "./SysMLv2Parser.js";
import { ForVariableDeclarationMemberContext } from "./SysMLv2Parser.js";
import { ActionTargetSuccessionContext } from "./SysMLv2Parser.js";
import { TargetSuccessionContext } from "./SysMLv2Parser.js";
import { GuardedTargetSuccessionContext } from "./SysMLv2Parser.js";
import { DefaultTargetSuccessionContext } from "./SysMLv2Parser.js";
import { GuardedSuccessionContext } from "./SysMLv2Parser.js";
import { StateDefinitionContext } from "./SysMLv2Parser.js";
import { StateDefBodyContext } from "./SysMLv2Parser.js";
import { StateBodyItemContext } from "./SysMLv2Parser.js";
import { EntryActionMemberContext } from "./SysMLv2Parser.js";
import { DoActionMemberContext } from "./SysMLv2Parser.js";
import { ExitActionMemberContext } from "./SysMLv2Parser.js";
import { EntryTransitionMemberContext } from "./SysMLv2Parser.js";
import { StateActionUsageContext } from "./SysMLv2Parser.js";
import { StatePerformActionUsageContext } from "./SysMLv2Parser.js";
import { StateAcceptActionUsageContext } from "./SysMLv2Parser.js";
import { StateSendActionUsageContext } from "./SysMLv2Parser.js";
import { StateAssignmentActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionUsageMemberContext } from "./SysMLv2Parser.js";
import { TargetTransitionUsageMemberContext } from "./SysMLv2Parser.js";
import { StateUsageContext } from "./SysMLv2Parser.js";
import { StateUsageBodyContext } from "./SysMLv2Parser.js";
import { ExhibitStateUsageContext } from "./SysMLv2Parser.js";
import { TransitionUsageContext } from "./SysMLv2Parser.js";
import { TargetTransitionUsageContext } from "./SysMLv2Parser.js";
import { TriggerActionMemberContext } from "./SysMLv2Parser.js";
import { TriggerActionContext } from "./SysMLv2Parser.js";
import { GuardExpressionMemberContext } from "./SysMLv2Parser.js";
import { EffectBehaviorMemberContext } from "./SysMLv2Parser.js";
import { EffectBehaviorUsageContext } from "./SysMLv2Parser.js";
import { TransitionPerformActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionAcceptActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionSendActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionAssignmentActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionSuccessionMemberContext } from "./SysMLv2Parser.js";
import { TransitionSuccessionContext } from "./SysMLv2Parser.js";
import { EmptyEndMemberContext } from "./SysMLv2Parser.js";
import { CalculationDefinitionContext } from "./SysMLv2Parser.js";
import { CalculationUsageContext } from "./SysMLv2Parser.js";
import { CalculationBodyContext } from "./SysMLv2Parser.js";
import { CalculationBodyPartContext } from "./SysMLv2Parser.js";
import { CalculationBodyItemContext } from "./SysMLv2Parser.js";
import { ReturnParameterMemberContext } from "./SysMLv2Parser.js";
import { ConstraintDefinitionContext } from "./SysMLv2Parser.js";
import { ConstraintUsageContext } from "./SysMLv2Parser.js";
import { AssertConstraintUsageContext } from "./SysMLv2Parser.js";
import { ConstraintUsageDeclarationContext } from "./SysMLv2Parser.js";
import { RequirementDefinitionContext } from "./SysMLv2Parser.js";
import { RequirementBodyContext } from "./SysMLv2Parser.js";
import { RequirementBodyItemContext } from "./SysMLv2Parser.js";
import { SubjectMemberContext } from "./SysMLv2Parser.js";
import { SubjectUsageContext } from "./SysMLv2Parser.js";
import { RequirementConstraintMemberContext } from "./SysMLv2Parser.js";
import { RequirementKindContext } from "./SysMLv2Parser.js";
import { RequirementConstraintUsageContext } from "./SysMLv2Parser.js";
import { FramedConcernMemberContext } from "./SysMLv2Parser.js";
import { FramedConcernUsageContext } from "./SysMLv2Parser.js";
import { ActorMemberContext } from "./SysMLv2Parser.js";
import { ActorUsageContext } from "./SysMLv2Parser.js";
import { StakeholderMemberContext } from "./SysMLv2Parser.js";
import { StakeholderUsageContext } from "./SysMLv2Parser.js";
import { RequirementUsageContext } from "./SysMLv2Parser.js";
import { SatisfyRequirementUsageContext } from "./SysMLv2Parser.js";
import { SatisfactionSubjectMemberContext } from "./SysMLv2Parser.js";
import { SatisfactionParameterContext } from "./SysMLv2Parser.js";
import { SatisfactionFeatureValueContext } from "./SysMLv2Parser.js";
import { SatisfactionReferenceExpressionContext } from "./SysMLv2Parser.js";
import { ConcernDefinitionContext } from "./SysMLv2Parser.js";
import { ConcernUsageContext } from "./SysMLv2Parser.js";
import { CaseDefinitionContext } from "./SysMLv2Parser.js";
import { CaseUsageContext } from "./SysMLv2Parser.js";
import { CaseBodyContext } from "./SysMLv2Parser.js";
import { CaseBodyItemContext } from "./SysMLv2Parser.js";
import { ObjectiveMemberContext } from "./SysMLv2Parser.js";
import { ObjectiveRequirementUsageContext } from "./SysMLv2Parser.js";
import { AnalysisCaseDefinitionContext } from "./SysMLv2Parser.js";
import { AnalysisCaseUsageContext } from "./SysMLv2Parser.js";
import { VerificationCaseDefinitionContext } from "./SysMLv2Parser.js";
import { VerificationCaseUsageContext } from "./SysMLv2Parser.js";
import { RequirementVerificationMemberContext } from "./SysMLv2Parser.js";
import { RequirementVerificationUsageContext } from "./SysMLv2Parser.js";
import { UseCaseDefinitionContext } from "./SysMLv2Parser.js";
import { UseCaseUsageContext } from "./SysMLv2Parser.js";
import { IncludeUseCaseUsageContext } from "./SysMLv2Parser.js";
import { ViewDefinitionContext } from "./SysMLv2Parser.js";
import { ViewDefinitionBodyContext } from "./SysMLv2Parser.js";
import { ViewDefinitionBodyItemContext } from "./SysMLv2Parser.js";
import { ViewRenderingMemberContext } from "./SysMLv2Parser.js";
import { ViewRenderingUsageContext } from "./SysMLv2Parser.js";
import { ViewUsageContext } from "./SysMLv2Parser.js";
import { ViewBodyContext } from "./SysMLv2Parser.js";
import { ViewBodyItemContext } from "./SysMLv2Parser.js";
import { ExposeContext } from "./SysMLv2Parser.js";
import { MembershipExposeContext } from "./SysMLv2Parser.js";
import { NamespaceExposeContext } from "./SysMLv2Parser.js";
import { ViewpointDefinitionContext } from "./SysMLv2Parser.js";
import { ViewpointUsageContext } from "./SysMLv2Parser.js";
import { RenderingDefinitionContext } from "./SysMLv2Parser.js";
import { RenderingUsageContext } from "./SysMLv2Parser.js";
import { MetadataDefinitionContext } from "./SysMLv2Parser.js";
import { PrefixMetadataUsageContext } from "./SysMLv2Parser.js";
import { MetadataBodyUsageMemberContext } from "./SysMLv2Parser.js";
import { MetadataBodyUsageContext } from "./SysMLv2Parser.js";
import { ExtendedDefinitionContext } from "./SysMLv2Parser.js";
import { ExtendedUsageContext } from "./SysMLv2Parser.js";
import { FilterPackageImportDeclarationContext } from "./SysMLv2Parser.js";
import { NamespaceImportDirectContext } from "./SysMLv2Parser.js";
import { CalculationUsageDeclarationContext } from "./SysMLv2Parser.js";
import { EmptyActionUsage_Context } from "./SysMLv2Parser.js";
import { EmptyFeature_Context } from "./SysMLv2Parser.js";
import { EmptyMultiplicity_Context } from "./SysMLv2Parser.js";
import { EmptyUsage_Context } from "./SysMLv2Parser.js";
import { FilterPackageImportContext } from "./SysMLv2Parser.js";
import { NonFeatureChainPrimaryExpressionContext } from "./SysMLv2Parser.js";
import { PortConjugationContext } from "./SysMLv2Parser.js";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `SysMLv2Parser`.
 */
export class SysMLv2ParserListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedExpression`.
     * @param ctx the parse tree
     */
    enterOwnedExpression?: (ctx: OwnedExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedExpression`.
     * @param ctx the parse tree
     */
    exitOwnedExpression?: (ctx: OwnedExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeReference`.
     * @param ctx the parse tree
     */
    enterTypeReference?: (ctx: TypeReferenceContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeReference`.
     * @param ctx the parse tree
     */
    exitTypeReference?: (ctx: TypeReferenceContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.sequenceExpressionList`.
     * @param ctx the parse tree
     */
    enterSequenceExpressionList?: (ctx: SequenceExpressionListContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.sequenceExpressionList`.
     * @param ctx the parse tree
     */
    exitSequenceExpressionList?: (ctx: SequenceExpressionListContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.baseExpression`.
     * @param ctx the parse tree
     */
    enterBaseExpression?: (ctx: BaseExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.baseExpression`.
     * @param ctx the parse tree
     */
    exitBaseExpression?: (ctx: BaseExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nullExpression`.
     * @param ctx the parse tree
     */
    enterNullExpression?: (ctx: NullExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nullExpression`.
     * @param ctx the parse tree
     */
    exitNullExpression?: (ctx: NullExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureReferenceExpression`.
     * @param ctx the parse tree
     */
    enterFeatureReferenceExpression?: (ctx: FeatureReferenceExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureReferenceExpression`.
     * @param ctx the parse tree
     */
    exitFeatureReferenceExpression?: (ctx: FeatureReferenceExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.constructorExpression`.
     * @param ctx the parse tree
     */
    enterConstructorExpression?: (ctx: ConstructorExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.constructorExpression`.
     * @param ctx the parse tree
     */
    exitConstructorExpression?: (ctx: ConstructorExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.bodyExpression`.
     * @param ctx the parse tree
     */
    enterBodyExpression?: (ctx: BodyExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.bodyExpression`.
     * @param ctx the parse tree
     */
    exitBodyExpression?: (ctx: BodyExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.argumentList`.
     * @param ctx the parse tree
     */
    enterArgumentList?: (ctx: ArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.argumentList`.
     * @param ctx the parse tree
     */
    exitArgumentList?: (ctx: ArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.positionalArgumentList`.
     * @param ctx the parse tree
     */
    enterPositionalArgumentList?: (ctx: PositionalArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.positionalArgumentList`.
     * @param ctx the parse tree
     */
    exitPositionalArgumentList?: (ctx: PositionalArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namedArgumentList`.
     * @param ctx the parse tree
     */
    enterNamedArgumentList?: (ctx: NamedArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namedArgumentList`.
     * @param ctx the parse tree
     */
    exitNamedArgumentList?: (ctx: NamedArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namedArgument`.
     * @param ctx the parse tree
     */
    enterNamedArgument?: (ctx: NamedArgumentContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namedArgument`.
     * @param ctx the parse tree
     */
    exitNamedArgument?: (ctx: NamedArgumentContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.literalExpression`.
     * @param ctx the parse tree
     */
    enterLiteralExpression?: (ctx: LiteralExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.literalExpression`.
     * @param ctx the parse tree
     */
    exitLiteralExpression?: (ctx: LiteralExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.literalBoolean`.
     * @param ctx the parse tree
     */
    enterLiteralBoolean?: (ctx: LiteralBooleanContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.literalBoolean`.
     * @param ctx the parse tree
     */
    exitLiteralBoolean?: (ctx: LiteralBooleanContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.literalString`.
     * @param ctx the parse tree
     */
    enterLiteralString?: (ctx: LiteralStringContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.literalString`.
     * @param ctx the parse tree
     */
    exitLiteralString?: (ctx: LiteralStringContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.literalInteger`.
     * @param ctx the parse tree
     */
    enterLiteralInteger?: (ctx: LiteralIntegerContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.literalInteger`.
     * @param ctx the parse tree
     */
    exitLiteralInteger?: (ctx: LiteralIntegerContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.literalReal`.
     * @param ctx the parse tree
     */
    enterLiteralReal?: (ctx: LiteralRealContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.literalReal`.
     * @param ctx the parse tree
     */
    exitLiteralReal?: (ctx: LiteralRealContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.literalInfinity`.
     * @param ctx the parse tree
     */
    enterLiteralInfinity?: (ctx: LiteralInfinityContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.literalInfinity`.
     * @param ctx the parse tree
     */
    exitLiteralInfinity?: (ctx: LiteralInfinityContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.argumentMember`.
     * @param ctx the parse tree
     */
    enterArgumentMember?: (ctx: ArgumentMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.argumentMember`.
     * @param ctx the parse tree
     */
    exitArgumentMember?: (ctx: ArgumentMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.argumentExpressionMember`.
     * @param ctx the parse tree
     */
    enterArgumentExpressionMember?: (ctx: ArgumentExpressionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.argumentExpressionMember`.
     * @param ctx the parse tree
     */
    exitArgumentExpressionMember?: (ctx: ArgumentExpressionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.name`.
     * @param ctx the parse tree
     */
    enterName?: (ctx: NameContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.name`.
     * @param ctx the parse tree
     */
    exitName?: (ctx: NameContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.unreservedKeyword`.
     * @param ctx the parse tree
     */
    enterUnreservedKeyword?: (ctx: UnreservedKeywordContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.unreservedKeyword`.
     * @param ctx the parse tree
     */
    exitUnreservedKeyword?: (ctx: UnreservedKeywordContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.identification`.
     * @param ctx the parse tree
     */
    enterIdentification?: (ctx: IdentificationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.identification`.
     * @param ctx the parse tree
     */
    exitIdentification?: (ctx: IdentificationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.relationshipBody`.
     * @param ctx the parse tree
     */
    enterRelationshipBody?: (ctx: RelationshipBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.relationshipBody`.
     * @param ctx the parse tree
     */
    exitRelationshipBody?: (ctx: RelationshipBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.relationshipOwnedElement`.
     * @param ctx the parse tree
     */
    enterRelationshipOwnedElement?: (ctx: RelationshipOwnedElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.relationshipOwnedElement`.
     * @param ctx the parse tree
     */
    exitRelationshipOwnedElement?: (ctx: RelationshipOwnedElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedRelatedElement`.
     * @param ctx the parse tree
     */
    enterOwnedRelatedElement?: (ctx: OwnedRelatedElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedRelatedElement`.
     * @param ctx the parse tree
     */
    exitOwnedRelatedElement?: (ctx: OwnedRelatedElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.dependency`.
     * @param ctx the parse tree
     */
    enterDependency?: (ctx: DependencyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.dependency`.
     * @param ctx the parse tree
     */
    exitDependency?: (ctx: DependencyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.annotation`.
     * @param ctx the parse tree
     */
    enterAnnotation?: (ctx: AnnotationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.annotation`.
     * @param ctx the parse tree
     */
    exitAnnotation?: (ctx: AnnotationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedAnnotation`.
     * @param ctx the parse tree
     */
    enterOwnedAnnotation?: (ctx: OwnedAnnotationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedAnnotation`.
     * @param ctx the parse tree
     */
    exitOwnedAnnotation?: (ctx: OwnedAnnotationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.annotatingElement`.
     * @param ctx the parse tree
     */
    enterAnnotatingElement?: (ctx: AnnotatingElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.annotatingElement`.
     * @param ctx the parse tree
     */
    exitAnnotatingElement?: (ctx: AnnotatingElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.comment`.
     * @param ctx the parse tree
     */
    enterComment?: (ctx: CommentContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.comment`.
     * @param ctx the parse tree
     */
    exitComment?: (ctx: CommentContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.documentation`.
     * @param ctx the parse tree
     */
    enterDocumentation?: (ctx: DocumentationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.documentation`.
     * @param ctx the parse tree
     */
    exitDocumentation?: (ctx: DocumentationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.textualRepresentation`.
     * @param ctx the parse tree
     */
    enterTextualRepresentation?: (ctx: TextualRepresentationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.textualRepresentation`.
     * @param ctx the parse tree
     */
    exitTextualRepresentation?: (ctx: TextualRepresentationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.rootNamespace`.
     * @param ctx the parse tree
     */
    enterRootNamespace?: (ctx: RootNamespaceContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.rootNamespace`.
     * @param ctx the parse tree
     */
    exitRootNamespace?: (ctx: RootNamespaceContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespace`.
     * @param ctx the parse tree
     */
    enterNamespace?: (ctx: NamespaceContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespace`.
     * @param ctx the parse tree
     */
    exitNamespace?: (ctx: NamespaceContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceDeclaration`.
     * @param ctx the parse tree
     */
    enterNamespaceDeclaration?: (ctx: NamespaceDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceDeclaration`.
     * @param ctx the parse tree
     */
    exitNamespaceDeclaration?: (ctx: NamespaceDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceBody`.
     * @param ctx the parse tree
     */
    enterNamespaceBody?: (ctx: NamespaceBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceBody`.
     * @param ctx the parse tree
     */
    exitNamespaceBody?: (ctx: NamespaceBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceBodyElement`.
     * @param ctx the parse tree
     */
    enterNamespaceBodyElement?: (ctx: NamespaceBodyElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceBodyElement`.
     * @param ctx the parse tree
     */
    exitNamespaceBodyElement?: (ctx: NamespaceBodyElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.memberPrefix`.
     * @param ctx the parse tree
     */
    enterMemberPrefix?: (ctx: MemberPrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.memberPrefix`.
     * @param ctx the parse tree
     */
    exitMemberPrefix?: (ctx: MemberPrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.visibilityIndicator`.
     * @param ctx the parse tree
     */
    enterVisibilityIndicator?: (ctx: VisibilityIndicatorContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.visibilityIndicator`.
     * @param ctx the parse tree
     */
    exitVisibilityIndicator?: (ctx: VisibilityIndicatorContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceMember`.
     * @param ctx the parse tree
     */
    enterNamespaceMember?: (ctx: NamespaceMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceMember`.
     * @param ctx the parse tree
     */
    exitNamespaceMember?: (ctx: NamespaceMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nonFeatureMember`.
     * @param ctx the parse tree
     */
    enterNonFeatureMember?: (ctx: NonFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nonFeatureMember`.
     * @param ctx the parse tree
     */
    exitNonFeatureMember?: (ctx: NonFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceFeatureMember`.
     * @param ctx the parse tree
     */
    enterNamespaceFeatureMember?: (ctx: NamespaceFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceFeatureMember`.
     * @param ctx the parse tree
     */
    exitNamespaceFeatureMember?: (ctx: NamespaceFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.aliasMember`.
     * @param ctx the parse tree
     */
    enterAliasMember?: (ctx: AliasMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.aliasMember`.
     * @param ctx the parse tree
     */
    exitAliasMember?: (ctx: AliasMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.qualifiedName`.
     * @param ctx the parse tree
     */
    enterQualifiedName?: (ctx: QualifiedNameContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.qualifiedName`.
     * @param ctx the parse tree
     */
    exitQualifiedName?: (ctx: QualifiedNameContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.importRule`.
     * @param ctx the parse tree
     */
    enterImportRule?: (ctx: ImportRuleContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.importRule`.
     * @param ctx the parse tree
     */
    exitImportRule?: (ctx: ImportRuleContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.importDeclaration`.
     * @param ctx the parse tree
     */
    enterImportDeclaration?: (ctx: ImportDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.importDeclaration`.
     * @param ctx the parse tree
     */
    exitImportDeclaration?: (ctx: ImportDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.membershipImport`.
     * @param ctx the parse tree
     */
    enterMembershipImport?: (ctx: MembershipImportContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.membershipImport`.
     * @param ctx the parse tree
     */
    exitMembershipImport?: (ctx: MembershipImportContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceImport`.
     * @param ctx the parse tree
     */
    enterNamespaceImport?: (ctx: NamespaceImportContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceImport`.
     * @param ctx the parse tree
     */
    exitNamespaceImport?: (ctx: NamespaceImportContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.filterPackage`.
     * @param ctx the parse tree
     */
    enterFilterPackage?: (ctx: FilterPackageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.filterPackage`.
     * @param ctx the parse tree
     */
    exitFilterPackage?: (ctx: FilterPackageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.filterPackageMember`.
     * @param ctx the parse tree
     */
    enterFilterPackageMember?: (ctx: FilterPackageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.filterPackageMember`.
     * @param ctx the parse tree
     */
    exitFilterPackageMember?: (ctx: FilterPackageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.memberElement`.
     * @param ctx the parse tree
     */
    enterMemberElement?: (ctx: MemberElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.memberElement`.
     * @param ctx the parse tree
     */
    exitMemberElement?: (ctx: MemberElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nonFeatureElement`.
     * @param ctx the parse tree
     */
    enterNonFeatureElement?: (ctx: NonFeatureElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nonFeatureElement`.
     * @param ctx the parse tree
     */
    exitNonFeatureElement?: (ctx: NonFeatureElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureElement`.
     * @param ctx the parse tree
     */
    enterFeatureElement?: (ctx: FeatureElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureElement`.
     * @param ctx the parse tree
     */
    exitFeatureElement?: (ctx: FeatureElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.type`.
     * @param ctx the parse tree
     */
    enterType?: (ctx: TypeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.type`.
     * @param ctx the parse tree
     */
    exitType?: (ctx: TypeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typePrefix`.
     * @param ctx the parse tree
     */
    enterTypePrefix?: (ctx: TypePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typePrefix`.
     * @param ctx the parse tree
     */
    exitTypePrefix?: (ctx: TypePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeDeclaration`.
     * @param ctx the parse tree
     */
    enterTypeDeclaration?: (ctx: TypeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeDeclaration`.
     * @param ctx the parse tree
     */
    exitTypeDeclaration?: (ctx: TypeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.specializationPart`.
     * @param ctx the parse tree
     */
    enterSpecializationPart?: (ctx: SpecializationPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.specializationPart`.
     * @param ctx the parse tree
     */
    exitSpecializationPart?: (ctx: SpecializationPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.conjugationPart`.
     * @param ctx the parse tree
     */
    enterConjugationPart?: (ctx: ConjugationPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.conjugationPart`.
     * @param ctx the parse tree
     */
    exitConjugationPart?: (ctx: ConjugationPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeRelationshipPart`.
     * @param ctx the parse tree
     */
    enterTypeRelationshipPart?: (ctx: TypeRelationshipPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeRelationshipPart`.
     * @param ctx the parse tree
     */
    exitTypeRelationshipPart?: (ctx: TypeRelationshipPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.disjoiningPart`.
     * @param ctx the parse tree
     */
    enterDisjoiningPart?: (ctx: DisjoiningPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.disjoiningPart`.
     * @param ctx the parse tree
     */
    exitDisjoiningPart?: (ctx: DisjoiningPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.unioningPart`.
     * @param ctx the parse tree
     */
    enterUnioningPart?: (ctx: UnioningPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.unioningPart`.
     * @param ctx the parse tree
     */
    exitUnioningPart?: (ctx: UnioningPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.intersectingPart`.
     * @param ctx the parse tree
     */
    enterIntersectingPart?: (ctx: IntersectingPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.intersectingPart`.
     * @param ctx the parse tree
     */
    exitIntersectingPart?: (ctx: IntersectingPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.differencingPart`.
     * @param ctx the parse tree
     */
    enterDifferencingPart?: (ctx: DifferencingPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.differencingPart`.
     * @param ctx the parse tree
     */
    exitDifferencingPart?: (ctx: DifferencingPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeBody`.
     * @param ctx the parse tree
     */
    enterTypeBody?: (ctx: TypeBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeBody`.
     * @param ctx the parse tree
     */
    exitTypeBody?: (ctx: TypeBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeBodyElement`.
     * @param ctx the parse tree
     */
    enterTypeBodyElement?: (ctx: TypeBodyElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeBodyElement`.
     * @param ctx the parse tree
     */
    exitTypeBodyElement?: (ctx: TypeBodyElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.specialization`.
     * @param ctx the parse tree
     */
    enterSpecialization?: (ctx: SpecializationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.specialization`.
     * @param ctx the parse tree
     */
    exitSpecialization?: (ctx: SpecializationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedSpecialization`.
     * @param ctx the parse tree
     */
    enterOwnedSpecialization?: (ctx: OwnedSpecializationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedSpecialization`.
     * @param ctx the parse tree
     */
    exitOwnedSpecialization?: (ctx: OwnedSpecializationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.specificType`.
     * @param ctx the parse tree
     */
    enterSpecificType?: (ctx: SpecificTypeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.specificType`.
     * @param ctx the parse tree
     */
    exitSpecificType?: (ctx: SpecificTypeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.generalType`.
     * @param ctx the parse tree
     */
    enterGeneralType?: (ctx: GeneralTypeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.generalType`.
     * @param ctx the parse tree
     */
    exitGeneralType?: (ctx: GeneralTypeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.conjugation`.
     * @param ctx the parse tree
     */
    enterConjugation?: (ctx: ConjugationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.conjugation`.
     * @param ctx the parse tree
     */
    exitConjugation?: (ctx: ConjugationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedConjugation`.
     * @param ctx the parse tree
     */
    enterOwnedConjugation?: (ctx: OwnedConjugationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedConjugation`.
     * @param ctx the parse tree
     */
    exitOwnedConjugation?: (ctx: OwnedConjugationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.disjoining`.
     * @param ctx the parse tree
     */
    enterDisjoining?: (ctx: DisjoiningContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.disjoining`.
     * @param ctx the parse tree
     */
    exitDisjoining?: (ctx: DisjoiningContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedDisjoining`.
     * @param ctx the parse tree
     */
    enterOwnedDisjoining?: (ctx: OwnedDisjoiningContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedDisjoining`.
     * @param ctx the parse tree
     */
    exitOwnedDisjoining?: (ctx: OwnedDisjoiningContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.unioning`.
     * @param ctx the parse tree
     */
    enterUnioning?: (ctx: UnioningContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.unioning`.
     * @param ctx the parse tree
     */
    exitUnioning?: (ctx: UnioningContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.intersecting`.
     * @param ctx the parse tree
     */
    enterIntersecting?: (ctx: IntersectingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.intersecting`.
     * @param ctx the parse tree
     */
    exitIntersecting?: (ctx: IntersectingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.differencing`.
     * @param ctx the parse tree
     */
    enterDifferencing?: (ctx: DifferencingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.differencing`.
     * @param ctx the parse tree
     */
    exitDifferencing?: (ctx: DifferencingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureMember`.
     * @param ctx the parse tree
     */
    enterFeatureMember?: (ctx: FeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureMember`.
     * @param ctx the parse tree
     */
    exitFeatureMember?: (ctx: FeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeFeatureMember`.
     * @param ctx the parse tree
     */
    enterTypeFeatureMember?: (ctx: TypeFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeFeatureMember`.
     * @param ctx the parse tree
     */
    exitTypeFeatureMember?: (ctx: TypeFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedFeatureMember`.
     * @param ctx the parse tree
     */
    enterOwnedFeatureMember?: (ctx: OwnedFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedFeatureMember`.
     * @param ctx the parse tree
     */
    exitOwnedFeatureMember?: (ctx: OwnedFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.classifier`.
     * @param ctx the parse tree
     */
    enterClassifier?: (ctx: ClassifierContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.classifier`.
     * @param ctx the parse tree
     */
    exitClassifier?: (ctx: ClassifierContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.classifierDeclaration`.
     * @param ctx the parse tree
     */
    enterClassifierDeclaration?: (ctx: ClassifierDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.classifierDeclaration`.
     * @param ctx the parse tree
     */
    exitClassifierDeclaration?: (ctx: ClassifierDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.superclassingPart`.
     * @param ctx the parse tree
     */
    enterSuperclassingPart?: (ctx: SuperclassingPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.superclassingPart`.
     * @param ctx the parse tree
     */
    exitSuperclassingPart?: (ctx: SuperclassingPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.subclassification`.
     * @param ctx the parse tree
     */
    enterSubclassification?: (ctx: SubclassificationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.subclassification`.
     * @param ctx the parse tree
     */
    exitSubclassification?: (ctx: SubclassificationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedSubclassification`.
     * @param ctx the parse tree
     */
    enterOwnedSubclassification?: (ctx: OwnedSubclassificationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedSubclassification`.
     * @param ctx the parse tree
     */
    exitOwnedSubclassification?: (ctx: OwnedSubclassificationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.feature`.
     * @param ctx the parse tree
     */
    enterFeature?: (ctx: FeatureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.feature`.
     * @param ctx the parse tree
     */
    exitFeature?: (ctx: FeatureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.endFeaturePrefix`.
     * @param ctx the parse tree
     */
    enterEndFeaturePrefix?: (ctx: EndFeaturePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.endFeaturePrefix`.
     * @param ctx the parse tree
     */
    exitEndFeaturePrefix?: (ctx: EndFeaturePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.basicFeaturePrefix`.
     * @param ctx the parse tree
     */
    enterBasicFeaturePrefix?: (ctx: BasicFeaturePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.basicFeaturePrefix`.
     * @param ctx the parse tree
     */
    exitBasicFeaturePrefix?: (ctx: BasicFeaturePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featurePrefix`.
     * @param ctx the parse tree
     */
    enterFeaturePrefix?: (ctx: FeaturePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featurePrefix`.
     * @param ctx the parse tree
     */
    exitFeaturePrefix?: (ctx: FeaturePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedCrossFeatureMember`.
     * @param ctx the parse tree
     */
    enterOwnedCrossFeatureMember?: (ctx: OwnedCrossFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedCrossFeatureMember`.
     * @param ctx the parse tree
     */
    exitOwnedCrossFeatureMember?: (ctx: OwnedCrossFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedCrossFeature`.
     * @param ctx the parse tree
     */
    enterOwnedCrossFeature?: (ctx: OwnedCrossFeatureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedCrossFeature`.
     * @param ctx the parse tree
     */
    exitOwnedCrossFeature?: (ctx: OwnedCrossFeatureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureDirection`.
     * @param ctx the parse tree
     */
    enterFeatureDirection?: (ctx: FeatureDirectionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureDirection`.
     * @param ctx the parse tree
     */
    exitFeatureDirection?: (ctx: FeatureDirectionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureDeclaration`.
     * @param ctx the parse tree
     */
    enterFeatureDeclaration?: (ctx: FeatureDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureDeclaration`.
     * @param ctx the parse tree
     */
    exitFeatureDeclaration?: (ctx: FeatureDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureIdentification`.
     * @param ctx the parse tree
     */
    enterFeatureIdentification?: (ctx: FeatureIdentificationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureIdentification`.
     * @param ctx the parse tree
     */
    exitFeatureIdentification?: (ctx: FeatureIdentificationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureRelationshipPart`.
     * @param ctx the parse tree
     */
    enterFeatureRelationshipPart?: (ctx: FeatureRelationshipPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureRelationshipPart`.
     * @param ctx the parse tree
     */
    exitFeatureRelationshipPart?: (ctx: FeatureRelationshipPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.chainingPart`.
     * @param ctx the parse tree
     */
    enterChainingPart?: (ctx: ChainingPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.chainingPart`.
     * @param ctx the parse tree
     */
    exitChainingPart?: (ctx: ChainingPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.invertingPart`.
     * @param ctx the parse tree
     */
    enterInvertingPart?: (ctx: InvertingPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.invertingPart`.
     * @param ctx the parse tree
     */
    exitInvertingPart?: (ctx: InvertingPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeFeaturingPart`.
     * @param ctx the parse tree
     */
    enterTypeFeaturingPart?: (ctx: TypeFeaturingPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeFeaturingPart`.
     * @param ctx the parse tree
     */
    exitTypeFeaturingPart?: (ctx: TypeFeaturingPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureSpecializationPart`.
     * @param ctx the parse tree
     */
    enterFeatureSpecializationPart?: (ctx: FeatureSpecializationPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureSpecializationPart`.
     * @param ctx the parse tree
     */
    exitFeatureSpecializationPart?: (ctx: FeatureSpecializationPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.multiplicityPart`.
     * @param ctx the parse tree
     */
    enterMultiplicityPart?: (ctx: MultiplicityPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.multiplicityPart`.
     * @param ctx the parse tree
     */
    exitMultiplicityPart?: (ctx: MultiplicityPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureSpecialization`.
     * @param ctx the parse tree
     */
    enterFeatureSpecialization?: (ctx: FeatureSpecializationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureSpecialization`.
     * @param ctx the parse tree
     */
    exitFeatureSpecialization?: (ctx: FeatureSpecializationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typings`.
     * @param ctx the parse tree
     */
    enterTypings?: (ctx: TypingsContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typings`.
     * @param ctx the parse tree
     */
    exitTypings?: (ctx: TypingsContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typedBy`.
     * @param ctx the parse tree
     */
    enterTypedBy?: (ctx: TypedByContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typedBy`.
     * @param ctx the parse tree
     */
    exitTypedBy?: (ctx: TypedByContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.subsettings`.
     * @param ctx the parse tree
     */
    enterSubsettings?: (ctx: SubsettingsContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.subsettings`.
     * @param ctx the parse tree
     */
    exitSubsettings?: (ctx: SubsettingsContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.subsets`.
     * @param ctx the parse tree
     */
    enterSubsets?: (ctx: SubsetsContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.subsets`.
     * @param ctx the parse tree
     */
    exitSubsets?: (ctx: SubsetsContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.references`.
     * @param ctx the parse tree
     */
    enterReferences?: (ctx: ReferencesContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.references`.
     * @param ctx the parse tree
     */
    exitReferences?: (ctx: ReferencesContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.crosses`.
     * @param ctx the parse tree
     */
    enterCrosses?: (ctx: CrossesContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.crosses`.
     * @param ctx the parse tree
     */
    exitCrosses?: (ctx: CrossesContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.redefinitions`.
     * @param ctx the parse tree
     */
    enterRedefinitions?: (ctx: RedefinitionsContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.redefinitions`.
     * @param ctx the parse tree
     */
    exitRedefinitions?: (ctx: RedefinitionsContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.redefines`.
     * @param ctx the parse tree
     */
    enterRedefines?: (ctx: RedefinesContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.redefines`.
     * @param ctx the parse tree
     */
    exitRedefines?: (ctx: RedefinesContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureTyping`.
     * @param ctx the parse tree
     */
    enterFeatureTyping?: (ctx: FeatureTypingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureTyping`.
     * @param ctx the parse tree
     */
    exitFeatureTyping?: (ctx: FeatureTypingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedFeatureTyping`.
     * @param ctx the parse tree
     */
    enterOwnedFeatureTyping?: (ctx: OwnedFeatureTypingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedFeatureTyping`.
     * @param ctx the parse tree
     */
    exitOwnedFeatureTyping?: (ctx: OwnedFeatureTypingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.subsetting`.
     * @param ctx the parse tree
     */
    enterSubsetting?: (ctx: SubsettingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.subsetting`.
     * @param ctx the parse tree
     */
    exitSubsetting?: (ctx: SubsettingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedSubsetting`.
     * @param ctx the parse tree
     */
    enterOwnedSubsetting?: (ctx: OwnedSubsettingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedSubsetting`.
     * @param ctx the parse tree
     */
    exitOwnedSubsetting?: (ctx: OwnedSubsettingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedReferenceSubsetting`.
     * @param ctx the parse tree
     */
    enterOwnedReferenceSubsetting?: (ctx: OwnedReferenceSubsettingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedReferenceSubsetting`.
     * @param ctx the parse tree
     */
    exitOwnedReferenceSubsetting?: (ctx: OwnedReferenceSubsettingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedCrossSubsetting`.
     * @param ctx the parse tree
     */
    enterOwnedCrossSubsetting?: (ctx: OwnedCrossSubsettingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedCrossSubsetting`.
     * @param ctx the parse tree
     */
    exitOwnedCrossSubsetting?: (ctx: OwnedCrossSubsettingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.redefinition`.
     * @param ctx the parse tree
     */
    enterRedefinition?: (ctx: RedefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.redefinition`.
     * @param ctx the parse tree
     */
    exitRedefinition?: (ctx: RedefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedRedefinition`.
     * @param ctx the parse tree
     */
    enterOwnedRedefinition?: (ctx: OwnedRedefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedRedefinition`.
     * @param ctx the parse tree
     */
    exitOwnedRedefinition?: (ctx: OwnedRedefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureInverting`.
     * @param ctx the parse tree
     */
    enterFeatureInverting?: (ctx: FeatureInvertingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureInverting`.
     * @param ctx the parse tree
     */
    exitFeatureInverting?: (ctx: FeatureInvertingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedFeatureInverting`.
     * @param ctx the parse tree
     */
    enterOwnedFeatureInverting?: (ctx: OwnedFeatureInvertingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedFeatureInverting`.
     * @param ctx the parse tree
     */
    exitOwnedFeatureInverting?: (ctx: OwnedFeatureInvertingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.typeFeaturing`.
     * @param ctx the parse tree
     */
    enterTypeFeaturing?: (ctx: TypeFeaturingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.typeFeaturing`.
     * @param ctx the parse tree
     */
    exitTypeFeaturing?: (ctx: TypeFeaturingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedTypeFeaturing`.
     * @param ctx the parse tree
     */
    enterOwnedTypeFeaturing?: (ctx: OwnedTypeFeaturingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedTypeFeaturing`.
     * @param ctx the parse tree
     */
    exitOwnedTypeFeaturing?: (ctx: OwnedTypeFeaturingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.dataType`.
     * @param ctx the parse tree
     */
    enterDataType?: (ctx: DataTypeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.dataType`.
     * @param ctx the parse tree
     */
    exitDataType?: (ctx: DataTypeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.class`.
     * @param ctx the parse tree
     */
    enterClass?: (ctx: ClassContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.class`.
     * @param ctx the parse tree
     */
    exitClass?: (ctx: ClassContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.structure`.
     * @param ctx the parse tree
     */
    enterStructure?: (ctx: StructureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.structure`.
     * @param ctx the parse tree
     */
    exitStructure?: (ctx: StructureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.association`.
     * @param ctx the parse tree
     */
    enterAssociation?: (ctx: AssociationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.association`.
     * @param ctx the parse tree
     */
    exitAssociation?: (ctx: AssociationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.associationStructure`.
     * @param ctx the parse tree
     */
    enterAssociationStructure?: (ctx: AssociationStructureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.associationStructure`.
     * @param ctx the parse tree
     */
    exitAssociationStructure?: (ctx: AssociationStructureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.connector`.
     * @param ctx the parse tree
     */
    enterConnector?: (ctx: ConnectorContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.connector`.
     * @param ctx the parse tree
     */
    exitConnector?: (ctx: ConnectorContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.connectorDeclaration`.
     * @param ctx the parse tree
     */
    enterConnectorDeclaration?: (ctx: ConnectorDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.connectorDeclaration`.
     * @param ctx the parse tree
     */
    exitConnectorDeclaration?: (ctx: ConnectorDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.binaryConnectorDeclaration`.
     * @param ctx the parse tree
     */
    enterBinaryConnectorDeclaration?: (ctx: BinaryConnectorDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.binaryConnectorDeclaration`.
     * @param ctx the parse tree
     */
    exitBinaryConnectorDeclaration?: (ctx: BinaryConnectorDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.naryConnectorDeclaration`.
     * @param ctx the parse tree
     */
    enterNaryConnectorDeclaration?: (ctx: NaryConnectorDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.naryConnectorDeclaration`.
     * @param ctx the parse tree
     */
    exitNaryConnectorDeclaration?: (ctx: NaryConnectorDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.connectorEndMember`.
     * @param ctx the parse tree
     */
    enterConnectorEndMember?: (ctx: ConnectorEndMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.connectorEndMember`.
     * @param ctx the parse tree
     */
    exitConnectorEndMember?: (ctx: ConnectorEndMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.connectorEnd`.
     * @param ctx the parse tree
     */
    enterConnectorEnd?: (ctx: ConnectorEndContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.connectorEnd`.
     * @param ctx the parse tree
     */
    exitConnectorEnd?: (ctx: ConnectorEndContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedCrossMultiplicityMember`.
     * @param ctx the parse tree
     */
    enterOwnedCrossMultiplicityMember?: (ctx: OwnedCrossMultiplicityMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedCrossMultiplicityMember`.
     * @param ctx the parse tree
     */
    exitOwnedCrossMultiplicityMember?: (ctx: OwnedCrossMultiplicityMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedCrossMultiplicity`.
     * @param ctx the parse tree
     */
    enterOwnedCrossMultiplicity?: (ctx: OwnedCrossMultiplicityContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedCrossMultiplicity`.
     * @param ctx the parse tree
     */
    exitOwnedCrossMultiplicity?: (ctx: OwnedCrossMultiplicityContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.bindingConnector`.
     * @param ctx the parse tree
     */
    enterBindingConnector?: (ctx: BindingConnectorContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.bindingConnector`.
     * @param ctx the parse tree
     */
    exitBindingConnector?: (ctx: BindingConnectorContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.bindingConnectorDeclaration`.
     * @param ctx the parse tree
     */
    enterBindingConnectorDeclaration?: (ctx: BindingConnectorDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.bindingConnectorDeclaration`.
     * @param ctx the parse tree
     */
    exitBindingConnectorDeclaration?: (ctx: BindingConnectorDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.succession`.
     * @param ctx the parse tree
     */
    enterSuccession?: (ctx: SuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.succession`.
     * @param ctx the parse tree
     */
    exitSuccession?: (ctx: SuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.successionDeclaration`.
     * @param ctx the parse tree
     */
    enterSuccessionDeclaration?: (ctx: SuccessionDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.successionDeclaration`.
     * @param ctx the parse tree
     */
    exitSuccessionDeclaration?: (ctx: SuccessionDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.behavior`.
     * @param ctx the parse tree
     */
    enterBehavior?: (ctx: BehaviorContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.behavior`.
     * @param ctx the parse tree
     */
    exitBehavior?: (ctx: BehaviorContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.step`.
     * @param ctx the parse tree
     */
    enterStep?: (ctx: StepContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.step`.
     * @param ctx the parse tree
     */
    exitStep?: (ctx: StepContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.function`.
     * @param ctx the parse tree
     */
    enterFunction?: (ctx: FunctionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.function`.
     * @param ctx the parse tree
     */
    exitFunction?: (ctx: FunctionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.functionBody`.
     * @param ctx the parse tree
     */
    enterFunctionBody?: (ctx: FunctionBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.functionBody`.
     * @param ctx the parse tree
     */
    exitFunctionBody?: (ctx: FunctionBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.functionBodyPart`.
     * @param ctx the parse tree
     */
    enterFunctionBodyPart?: (ctx: FunctionBodyPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.functionBodyPart`.
     * @param ctx the parse tree
     */
    exitFunctionBodyPart?: (ctx: FunctionBodyPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.returnFeatureMember`.
     * @param ctx the parse tree
     */
    enterReturnFeatureMember?: (ctx: ReturnFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.returnFeatureMember`.
     * @param ctx the parse tree
     */
    exitReturnFeatureMember?: (ctx: ReturnFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.resultExpressionMember`.
     * @param ctx the parse tree
     */
    enterResultExpressionMember?: (ctx: ResultExpressionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.resultExpressionMember`.
     * @param ctx the parse tree
     */
    exitResultExpressionMember?: (ctx: ResultExpressionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.expression`.
     * @param ctx the parse tree
     */
    enterExpression?: (ctx: ExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.expression`.
     * @param ctx the parse tree
     */
    exitExpression?: (ctx: ExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.predicate`.
     * @param ctx the parse tree
     */
    enterPredicate?: (ctx: PredicateContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.predicate`.
     * @param ctx the parse tree
     */
    exitPredicate?: (ctx: PredicateContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.booleanExpression`.
     * @param ctx the parse tree
     */
    enterBooleanExpression?: (ctx: BooleanExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.booleanExpression`.
     * @param ctx the parse tree
     */
    exitBooleanExpression?: (ctx: BooleanExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.invariant`.
     * @param ctx the parse tree
     */
    enterInvariant?: (ctx: InvariantContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.invariant`.
     * @param ctx the parse tree
     */
    exitInvariant?: (ctx: InvariantContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureChainMember`.
     * @param ctx the parse tree
     */
    enterFeatureChainMember?: (ctx: FeatureChainMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureChainMember`.
     * @param ctx the parse tree
     */
    exitFeatureChainMember?: (ctx: FeatureChainMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interaction`.
     * @param ctx the parse tree
     */
    enterInteraction?: (ctx: InteractionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interaction`.
     * @param ctx the parse tree
     */
    exitInteraction?: (ctx: InteractionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flow`.
     * @param ctx the parse tree
     */
    enterFlow?: (ctx: FlowContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flow`.
     * @param ctx the parse tree
     */
    exitFlow?: (ctx: FlowContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.successionFlow`.
     * @param ctx the parse tree
     */
    enterSuccessionFlow?: (ctx: SuccessionFlowContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.successionFlow`.
     * @param ctx the parse tree
     */
    exitSuccessionFlow?: (ctx: SuccessionFlowContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flowDeclaration`.
     * @param ctx the parse tree
     */
    enterFlowDeclaration?: (ctx: FlowDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flowDeclaration`.
     * @param ctx the parse tree
     */
    exitFlowDeclaration?: (ctx: FlowDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.payloadFeatureMember`.
     * @param ctx the parse tree
     */
    enterPayloadFeatureMember?: (ctx: PayloadFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.payloadFeatureMember`.
     * @param ctx the parse tree
     */
    exitPayloadFeatureMember?: (ctx: PayloadFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.payloadFeature`.
     * @param ctx the parse tree
     */
    enterPayloadFeature?: (ctx: PayloadFeatureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.payloadFeature`.
     * @param ctx the parse tree
     */
    exitPayloadFeature?: (ctx: PayloadFeatureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.payloadFeatureSpecializationPart`.
     * @param ctx the parse tree
     */
    enterPayloadFeatureSpecializationPart?: (ctx: PayloadFeatureSpecializationPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.payloadFeatureSpecializationPart`.
     * @param ctx the parse tree
     */
    exitPayloadFeatureSpecializationPart?: (ctx: PayloadFeatureSpecializationPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flowEndMember`.
     * @param ctx the parse tree
     */
    enterFlowEndMember?: (ctx: FlowEndMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flowEndMember`.
     * @param ctx the parse tree
     */
    exitFlowEndMember?: (ctx: FlowEndMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flowEnd`.
     * @param ctx the parse tree
     */
    enterFlowEnd?: (ctx: FlowEndContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flowEnd`.
     * @param ctx the parse tree
     */
    exitFlowEnd?: (ctx: FlowEndContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.valuePart`.
     * @param ctx the parse tree
     */
    enterValuePart?: (ctx: ValuePartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.valuePart`.
     * @param ctx the parse tree
     */
    exitValuePart?: (ctx: ValuePartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureValue`.
     * @param ctx the parse tree
     */
    enterFeatureValue?: (ctx: FeatureValueContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureValue`.
     * @param ctx the parse tree
     */
    exitFeatureValue?: (ctx: FeatureValueContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.multiplicity`.
     * @param ctx the parse tree
     */
    enterMultiplicity?: (ctx: MultiplicityContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.multiplicity`.
     * @param ctx the parse tree
     */
    exitMultiplicity?: (ctx: MultiplicityContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.multiplicitySubset`.
     * @param ctx the parse tree
     */
    enterMultiplicitySubset?: (ctx: MultiplicitySubsetContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.multiplicitySubset`.
     * @param ctx the parse tree
     */
    exitMultiplicitySubset?: (ctx: MultiplicitySubsetContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.multiplicityRange`.
     * @param ctx the parse tree
     */
    enterMultiplicityRange?: (ctx: MultiplicityRangeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.multiplicityRange`.
     * @param ctx the parse tree
     */
    exitMultiplicityRange?: (ctx: MultiplicityRangeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedMultiplicity`.
     * @param ctx the parse tree
     */
    enterOwnedMultiplicity?: (ctx: OwnedMultiplicityContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedMultiplicity`.
     * @param ctx the parse tree
     */
    exitOwnedMultiplicity?: (ctx: OwnedMultiplicityContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ownedMultiplicityRange`.
     * @param ctx the parse tree
     */
    enterOwnedMultiplicityRange?: (ctx: OwnedMultiplicityRangeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ownedMultiplicityRange`.
     * @param ctx the parse tree
     */
    exitOwnedMultiplicityRange?: (ctx: OwnedMultiplicityRangeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.multiplicityBounds`.
     * @param ctx the parse tree
     */
    enterMultiplicityBounds?: (ctx: MultiplicityBoundsContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.multiplicityBounds`.
     * @param ctx the parse tree
     */
    exitMultiplicityBounds?: (ctx: MultiplicityBoundsContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.multiplicityExpressionMember`.
     * @param ctx the parse tree
     */
    enterMultiplicityExpressionMember?: (ctx: MultiplicityExpressionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.multiplicityExpressionMember`.
     * @param ctx the parse tree
     */
    exitMultiplicityExpressionMember?: (ctx: MultiplicityExpressionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metaclass`.
     * @param ctx the parse tree
     */
    enterMetaclass?: (ctx: MetaclassContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metaclass`.
     * @param ctx the parse tree
     */
    exitMetaclass?: (ctx: MetaclassContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.prefixMetadataAnnotation`.
     * @param ctx the parse tree
     */
    enterPrefixMetadataAnnotation?: (ctx: PrefixMetadataAnnotationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.prefixMetadataAnnotation`.
     * @param ctx the parse tree
     */
    exitPrefixMetadataAnnotation?: (ctx: PrefixMetadataAnnotationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.prefixMetadataMember`.
     * @param ctx the parse tree
     */
    enterPrefixMetadataMember?: (ctx: PrefixMetadataMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.prefixMetadataMember`.
     * @param ctx the parse tree
     */
    exitPrefixMetadataMember?: (ctx: PrefixMetadataMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.prefixMetadataFeature`.
     * @param ctx the parse tree
     */
    enterPrefixMetadataFeature?: (ctx: PrefixMetadataFeatureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.prefixMetadataFeature`.
     * @param ctx the parse tree
     */
    exitPrefixMetadataFeature?: (ctx: PrefixMetadataFeatureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataFeature`.
     * @param ctx the parse tree
     */
    enterMetadataFeature?: (ctx: MetadataFeatureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataFeature`.
     * @param ctx the parse tree
     */
    exitMetadataFeature?: (ctx: MetadataFeatureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataFeatureDeclaration`.
     * @param ctx the parse tree
     */
    enterMetadataFeatureDeclaration?: (ctx: MetadataFeatureDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataFeatureDeclaration`.
     * @param ctx the parse tree
     */
    exitMetadataFeatureDeclaration?: (ctx: MetadataFeatureDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataBody`.
     * @param ctx the parse tree
     */
    enterMetadataBody?: (ctx: MetadataBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataBody`.
     * @param ctx the parse tree
     */
    exitMetadataBody?: (ctx: MetadataBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataBodyElement`.
     * @param ctx the parse tree
     */
    enterMetadataBodyElement?: (ctx: MetadataBodyElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataBodyElement`.
     * @param ctx the parse tree
     */
    exitMetadataBodyElement?: (ctx: MetadataBodyElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataBodyFeatureMember`.
     * @param ctx the parse tree
     */
    enterMetadataBodyFeatureMember?: (ctx: MetadataBodyFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataBodyFeatureMember`.
     * @param ctx the parse tree
     */
    exitMetadataBodyFeatureMember?: (ctx: MetadataBodyFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataBodyFeature`.
     * @param ctx the parse tree
     */
    enterMetadataBodyFeature?: (ctx: MetadataBodyFeatureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataBodyFeature`.
     * @param ctx the parse tree
     */
    exitMetadataBodyFeature?: (ctx: MetadataBodyFeatureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.package`.
     * @param ctx the parse tree
     */
    enterPackage?: (ctx: PackageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.package`.
     * @param ctx the parse tree
     */
    exitPackage?: (ctx: PackageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.libraryPackage`.
     * @param ctx the parse tree
     */
    enterLibraryPackage?: (ctx: LibraryPackageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.libraryPackage`.
     * @param ctx the parse tree
     */
    exitLibraryPackage?: (ctx: LibraryPackageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.packageDeclaration`.
     * @param ctx the parse tree
     */
    enterPackageDeclaration?: (ctx: PackageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.packageDeclaration`.
     * @param ctx the parse tree
     */
    exitPackageDeclaration?: (ctx: PackageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.packageBody`.
     * @param ctx the parse tree
     */
    enterPackageBody?: (ctx: PackageBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.packageBody`.
     * @param ctx the parse tree
     */
    exitPackageBody?: (ctx: PackageBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.elementFilterMember`.
     * @param ctx the parse tree
     */
    enterElementFilterMember?: (ctx: ElementFilterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.elementFilterMember`.
     * @param ctx the parse tree
     */
    exitElementFilterMember?: (ctx: ElementFilterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.dependencyDeclaration`.
     * @param ctx the parse tree
     */
    enterDependencyDeclaration?: (ctx: DependencyDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.dependencyDeclaration`.
     * @param ctx the parse tree
     */
    exitDependencyDeclaration?: (ctx: DependencyDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.annotatingMember`.
     * @param ctx the parse tree
     */
    enterAnnotatingMember?: (ctx: AnnotatingMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.annotatingMember`.
     * @param ctx the parse tree
     */
    exitAnnotatingMember?: (ctx: AnnotatingMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.packageBodyElement`.
     * @param ctx the parse tree
     */
    enterPackageBodyElement?: (ctx: PackageBodyElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.packageBodyElement`.
     * @param ctx the parse tree
     */
    exitPackageBodyElement?: (ctx: PackageBodyElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.packageMember`.
     * @param ctx the parse tree
     */
    enterPackageMember?: (ctx: PackageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.packageMember`.
     * @param ctx the parse tree
     */
    exitPackageMember?: (ctx: PackageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionElement`.
     * @param ctx the parse tree
     */
    enterDefinitionElement?: (ctx: DefinitionElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionElement`.
     * @param ctx the parse tree
     */
    exitDefinitionElement?: (ctx: DefinitionElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.usageElement`.
     * @param ctx the parse tree
     */
    enterUsageElement?: (ctx: UsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.usageElement`.
     * @param ctx the parse tree
     */
    exitUsageElement?: (ctx: UsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.basicDefinitionPrefix`.
     * @param ctx the parse tree
     */
    enterBasicDefinitionPrefix?: (ctx: BasicDefinitionPrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.basicDefinitionPrefix`.
     * @param ctx the parse tree
     */
    exitBasicDefinitionPrefix?: (ctx: BasicDefinitionPrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionExtensionKeyword`.
     * @param ctx the parse tree
     */
    enterDefinitionExtensionKeyword?: (ctx: DefinitionExtensionKeywordContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionExtensionKeyword`.
     * @param ctx the parse tree
     */
    exitDefinitionExtensionKeyword?: (ctx: DefinitionExtensionKeywordContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionPrefix`.
     * @param ctx the parse tree
     */
    enterDefinitionPrefix?: (ctx: DefinitionPrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionPrefix`.
     * @param ctx the parse tree
     */
    exitDefinitionPrefix?: (ctx: DefinitionPrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definition`.
     * @param ctx the parse tree
     */
    enterDefinition?: (ctx: DefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definition`.
     * @param ctx the parse tree
     */
    exitDefinition?: (ctx: DefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionDeclaration`.
     * @param ctx the parse tree
     */
    enterDefinitionDeclaration?: (ctx: DefinitionDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionDeclaration`.
     * @param ctx the parse tree
     */
    exitDefinitionDeclaration?: (ctx: DefinitionDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionBody`.
     * @param ctx the parse tree
     */
    enterDefinitionBody?: (ctx: DefinitionBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionBody`.
     * @param ctx the parse tree
     */
    exitDefinitionBody?: (ctx: DefinitionBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionBodyItem`.
     * @param ctx the parse tree
     */
    enterDefinitionBodyItem?: (ctx: DefinitionBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionBodyItem`.
     * @param ctx the parse tree
     */
    exitDefinitionBodyItem?: (ctx: DefinitionBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionBodyItemContent`.
     * @param ctx the parse tree
     */
    enterDefinitionBodyItemContent?: (ctx: DefinitionBodyItemContentContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionBodyItemContent`.
     * @param ctx the parse tree
     */
    exitDefinitionBodyItemContent?: (ctx: DefinitionBodyItemContentContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.definitionMember`.
     * @param ctx the parse tree
     */
    enterDefinitionMember?: (ctx: DefinitionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.definitionMember`.
     * @param ctx the parse tree
     */
    exitDefinitionMember?: (ctx: DefinitionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.variantUsageMember`.
     * @param ctx the parse tree
     */
    enterVariantUsageMember?: (ctx: VariantUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.variantUsageMember`.
     * @param ctx the parse tree
     */
    exitVariantUsageMember?: (ctx: VariantUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nonOccurrenceUsageMember`.
     * @param ctx the parse tree
     */
    enterNonOccurrenceUsageMember?: (ctx: NonOccurrenceUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nonOccurrenceUsageMember`.
     * @param ctx the parse tree
     */
    exitNonOccurrenceUsageMember?: (ctx: NonOccurrenceUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.structureUsageMember`.
     * @param ctx the parse tree
     */
    enterStructureUsageMember?: (ctx: StructureUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.structureUsageMember`.
     * @param ctx the parse tree
     */
    exitStructureUsageMember?: (ctx: StructureUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.behaviorUsageMember`.
     * @param ctx the parse tree
     */
    enterBehaviorUsageMember?: (ctx: BehaviorUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.behaviorUsageMember`.
     * @param ctx the parse tree
     */
    exitBehaviorUsageMember?: (ctx: BehaviorUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.refPrefix`.
     * @param ctx the parse tree
     */
    enterRefPrefix?: (ctx: RefPrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.refPrefix`.
     * @param ctx the parse tree
     */
    exitRefPrefix?: (ctx: RefPrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.basicUsagePrefix`.
     * @param ctx the parse tree
     */
    enterBasicUsagePrefix?: (ctx: BasicUsagePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.basicUsagePrefix`.
     * @param ctx the parse tree
     */
    exitBasicUsagePrefix?: (ctx: BasicUsagePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.endUsagePrefix`.
     * @param ctx the parse tree
     */
    enterEndUsagePrefix?: (ctx: EndUsagePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.endUsagePrefix`.
     * @param ctx the parse tree
     */
    exitEndUsagePrefix?: (ctx: EndUsagePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.usageExtensionKeyword`.
     * @param ctx the parse tree
     */
    enterUsageExtensionKeyword?: (ctx: UsageExtensionKeywordContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.usageExtensionKeyword`.
     * @param ctx the parse tree
     */
    exitUsageExtensionKeyword?: (ctx: UsageExtensionKeywordContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.unextendedUsagePrefix`.
     * @param ctx the parse tree
     */
    enterUnextendedUsagePrefix?: (ctx: UnextendedUsagePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.unextendedUsagePrefix`.
     * @param ctx the parse tree
     */
    exitUnextendedUsagePrefix?: (ctx: UnextendedUsagePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.usagePrefix`.
     * @param ctx the parse tree
     */
    enterUsagePrefix?: (ctx: UsagePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.usagePrefix`.
     * @param ctx the parse tree
     */
    exitUsagePrefix?: (ctx: UsagePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.usage`.
     * @param ctx the parse tree
     */
    enterUsage?: (ctx: UsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.usage`.
     * @param ctx the parse tree
     */
    exitUsage?: (ctx: UsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.usageDeclaration`.
     * @param ctx the parse tree
     */
    enterUsageDeclaration?: (ctx: UsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.usageDeclaration`.
     * @param ctx the parse tree
     */
    exitUsageDeclaration?: (ctx: UsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.usageCompletion`.
     * @param ctx the parse tree
     */
    enterUsageCompletion?: (ctx: UsageCompletionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.usageCompletion`.
     * @param ctx the parse tree
     */
    exitUsageCompletion?: (ctx: UsageCompletionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.usageBody`.
     * @param ctx the parse tree
     */
    enterUsageBody?: (ctx: UsageBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.usageBody`.
     * @param ctx the parse tree
     */
    exitUsageBody?: (ctx: UsageBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.defaultReferenceUsage`.
     * @param ctx the parse tree
     */
    enterDefaultReferenceUsage?: (ctx: DefaultReferenceUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.defaultReferenceUsage`.
     * @param ctx the parse tree
     */
    exitDefaultReferenceUsage?: (ctx: DefaultReferenceUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.referenceUsage`.
     * @param ctx the parse tree
     */
    enterReferenceUsage?: (ctx: ReferenceUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.referenceUsage`.
     * @param ctx the parse tree
     */
    exitReferenceUsage?: (ctx: ReferenceUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.endFeatureUsage`.
     * @param ctx the parse tree
     */
    enterEndFeatureUsage?: (ctx: EndFeatureUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.endFeatureUsage`.
     * @param ctx the parse tree
     */
    exitEndFeatureUsage?: (ctx: EndFeatureUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.variantReference`.
     * @param ctx the parse tree
     */
    enterVariantReference?: (ctx: VariantReferenceContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.variantReference`.
     * @param ctx the parse tree
     */
    exitVariantReference?: (ctx: VariantReferenceContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nonOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    enterNonOccurrenceUsageElement?: (ctx: NonOccurrenceUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nonOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    exitNonOccurrenceUsageElement?: (ctx: NonOccurrenceUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.endOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    enterEndOccurrenceUsageElement?: (ctx: EndOccurrenceUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.endOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    exitEndOccurrenceUsageElement?: (ctx: EndOccurrenceUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.occurrenceUsageElement`.
     * @param ctx the parse tree
     */
    enterOccurrenceUsageElement?: (ctx: OccurrenceUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.occurrenceUsageElement`.
     * @param ctx the parse tree
     */
    exitOccurrenceUsageElement?: (ctx: OccurrenceUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.structureUsageElement`.
     * @param ctx the parse tree
     */
    enterStructureUsageElement?: (ctx: StructureUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.structureUsageElement`.
     * @param ctx the parse tree
     */
    exitStructureUsageElement?: (ctx: StructureUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.behaviorUsageElement`.
     * @param ctx the parse tree
     */
    enterBehaviorUsageElement?: (ctx: BehaviorUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.behaviorUsageElement`.
     * @param ctx the parse tree
     */
    exitBehaviorUsageElement?: (ctx: BehaviorUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.variantUsageElement`.
     * @param ctx the parse tree
     */
    enterVariantUsageElement?: (ctx: VariantUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.variantUsageElement`.
     * @param ctx the parse tree
     */
    exitVariantUsageElement?: (ctx: VariantUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.subclassificationPart`.
     * @param ctx the parse tree
     */
    enterSubclassificationPart?: (ctx: SubclassificationPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.subclassificationPart`.
     * @param ctx the parse tree
     */
    exitSubclassificationPart?: (ctx: SubclassificationPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.attributeDefinition`.
     * @param ctx the parse tree
     */
    enterAttributeDefinition?: (ctx: AttributeDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.attributeDefinition`.
     * @param ctx the parse tree
     */
    exitAttributeDefinition?: (ctx: AttributeDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.attributeUsage`.
     * @param ctx the parse tree
     */
    enterAttributeUsage?: (ctx: AttributeUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.attributeUsage`.
     * @param ctx the parse tree
     */
    exitAttributeUsage?: (ctx: AttributeUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.enumerationDefinition`.
     * @param ctx the parse tree
     */
    enterEnumerationDefinition?: (ctx: EnumerationDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.enumerationDefinition`.
     * @param ctx the parse tree
     */
    exitEnumerationDefinition?: (ctx: EnumerationDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.enumerationBody`.
     * @param ctx the parse tree
     */
    enterEnumerationBody?: (ctx: EnumerationBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.enumerationBody`.
     * @param ctx the parse tree
     */
    exitEnumerationBody?: (ctx: EnumerationBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.enumerationUsageMember`.
     * @param ctx the parse tree
     */
    enterEnumerationUsageMember?: (ctx: EnumerationUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.enumerationUsageMember`.
     * @param ctx the parse tree
     */
    exitEnumerationUsageMember?: (ctx: EnumerationUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.enumeratedValue`.
     * @param ctx the parse tree
     */
    enterEnumeratedValue?: (ctx: EnumeratedValueContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.enumeratedValue`.
     * @param ctx the parse tree
     */
    exitEnumeratedValue?: (ctx: EnumeratedValueContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.enumerationUsage`.
     * @param ctx the parse tree
     */
    enterEnumerationUsage?: (ctx: EnumerationUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.enumerationUsage`.
     * @param ctx the parse tree
     */
    exitEnumerationUsage?: (ctx: EnumerationUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.occurrenceDefinitionPrefix`.
     * @param ctx the parse tree
     */
    enterOccurrenceDefinitionPrefix?: (ctx: OccurrenceDefinitionPrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.occurrenceDefinitionPrefix`.
     * @param ctx the parse tree
     */
    exitOccurrenceDefinitionPrefix?: (ctx: OccurrenceDefinitionPrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.occurrenceDefinition`.
     * @param ctx the parse tree
     */
    enterOccurrenceDefinition?: (ctx: OccurrenceDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.occurrenceDefinition`.
     * @param ctx the parse tree
     */
    exitOccurrenceDefinition?: (ctx: OccurrenceDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.individualDefinition`.
     * @param ctx the parse tree
     */
    enterIndividualDefinition?: (ctx: IndividualDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.individualDefinition`.
     * @param ctx the parse tree
     */
    exitIndividualDefinition?: (ctx: IndividualDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.emptyMultiplicityMember`.
     * @param ctx the parse tree
     */
    enterEmptyMultiplicityMember?: (ctx: EmptyMultiplicityMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.emptyMultiplicityMember`.
     * @param ctx the parse tree
     */
    exitEmptyMultiplicityMember?: (ctx: EmptyMultiplicityMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.occurrenceUsagePrefix`.
     * @param ctx the parse tree
     */
    enterOccurrenceUsagePrefix?: (ctx: OccurrenceUsagePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.occurrenceUsagePrefix`.
     * @param ctx the parse tree
     */
    exitOccurrenceUsagePrefix?: (ctx: OccurrenceUsagePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.occurrenceUsage`.
     * @param ctx the parse tree
     */
    enterOccurrenceUsage?: (ctx: OccurrenceUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.occurrenceUsage`.
     * @param ctx the parse tree
     */
    exitOccurrenceUsage?: (ctx: OccurrenceUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.individualUsage`.
     * @param ctx the parse tree
     */
    enterIndividualUsage?: (ctx: IndividualUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.individualUsage`.
     * @param ctx the parse tree
     */
    exitIndividualUsage?: (ctx: IndividualUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.portionUsage`.
     * @param ctx the parse tree
     */
    enterPortionUsage?: (ctx: PortionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.portionUsage`.
     * @param ctx the parse tree
     */
    exitPortionUsage?: (ctx: PortionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.portionKind`.
     * @param ctx the parse tree
     */
    enterPortionKind?: (ctx: PortionKindContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.portionKind`.
     * @param ctx the parse tree
     */
    exitPortionKind?: (ctx: PortionKindContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.eventOccurrenceUsage`.
     * @param ctx the parse tree
     */
    enterEventOccurrenceUsage?: (ctx: EventOccurrenceUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.eventOccurrenceUsage`.
     * @param ctx the parse tree
     */
    exitEventOccurrenceUsage?: (ctx: EventOccurrenceUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.sourceSuccessionMember`.
     * @param ctx the parse tree
     */
    enterSourceSuccessionMember?: (ctx: SourceSuccessionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.sourceSuccessionMember`.
     * @param ctx the parse tree
     */
    exitSourceSuccessionMember?: (ctx: SourceSuccessionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.sourceSuccession`.
     * @param ctx the parse tree
     */
    enterSourceSuccession?: (ctx: SourceSuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.sourceSuccession`.
     * @param ctx the parse tree
     */
    exitSourceSuccession?: (ctx: SourceSuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.sourceEndMember`.
     * @param ctx the parse tree
     */
    enterSourceEndMember?: (ctx: SourceEndMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.sourceEndMember`.
     * @param ctx the parse tree
     */
    exitSourceEndMember?: (ctx: SourceEndMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.sourceEnd`.
     * @param ctx the parse tree
     */
    enterSourceEnd?: (ctx: SourceEndContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.sourceEnd`.
     * @param ctx the parse tree
     */
    exitSourceEnd?: (ctx: SourceEndContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.itemDefinition`.
     * @param ctx the parse tree
     */
    enterItemDefinition?: (ctx: ItemDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.itemDefinition`.
     * @param ctx the parse tree
     */
    exitItemDefinition?: (ctx: ItemDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.itemUsage`.
     * @param ctx the parse tree
     */
    enterItemUsage?: (ctx: ItemUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.itemUsage`.
     * @param ctx the parse tree
     */
    exitItemUsage?: (ctx: ItemUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.partDefinition`.
     * @param ctx the parse tree
     */
    enterPartDefinition?: (ctx: PartDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.partDefinition`.
     * @param ctx the parse tree
     */
    exitPartDefinition?: (ctx: PartDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.partUsage`.
     * @param ctx the parse tree
     */
    enterPartUsage?: (ctx: PartUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.partUsage`.
     * @param ctx the parse tree
     */
    exitPartUsage?: (ctx: PartUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.portDefinition`.
     * @param ctx the parse tree
     */
    enterPortDefinition?: (ctx: PortDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.portDefinition`.
     * @param ctx the parse tree
     */
    exitPortDefinition?: (ctx: PortDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.conjugatedPortDefinitionMember`.
     * @param ctx the parse tree
     */
    enterConjugatedPortDefinitionMember?: (ctx: ConjugatedPortDefinitionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.conjugatedPortDefinitionMember`.
     * @param ctx the parse tree
     */
    exitConjugatedPortDefinitionMember?: (ctx: ConjugatedPortDefinitionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.conjugatedPortDefinition`.
     * @param ctx the parse tree
     */
    enterConjugatedPortDefinition?: (ctx: ConjugatedPortDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.conjugatedPortDefinition`.
     * @param ctx the parse tree
     */
    exitConjugatedPortDefinition?: (ctx: ConjugatedPortDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.portUsage`.
     * @param ctx the parse tree
     */
    enterPortUsage?: (ctx: PortUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.portUsage`.
     * @param ctx the parse tree
     */
    exitPortUsage?: (ctx: PortUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.conjugatedPortTyping`.
     * @param ctx the parse tree
     */
    enterConjugatedPortTyping?: (ctx: ConjugatedPortTypingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.conjugatedPortTyping`.
     * @param ctx the parse tree
     */
    exitConjugatedPortTyping?: (ctx: ConjugatedPortTypingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.connectionDefinition`.
     * @param ctx the parse tree
     */
    enterConnectionDefinition?: (ctx: ConnectionDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.connectionDefinition`.
     * @param ctx the parse tree
     */
    exitConnectionDefinition?: (ctx: ConnectionDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.connectionUsage`.
     * @param ctx the parse tree
     */
    enterConnectionUsage?: (ctx: ConnectionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.connectionUsage`.
     * @param ctx the parse tree
     */
    exitConnectionUsage?: (ctx: ConnectionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.connectorPart`.
     * @param ctx the parse tree
     */
    enterConnectorPart?: (ctx: ConnectorPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.connectorPart`.
     * @param ctx the parse tree
     */
    exitConnectorPart?: (ctx: ConnectorPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.binaryConnectorPart`.
     * @param ctx the parse tree
     */
    enterBinaryConnectorPart?: (ctx: BinaryConnectorPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.binaryConnectorPart`.
     * @param ctx the parse tree
     */
    exitBinaryConnectorPart?: (ctx: BinaryConnectorPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.naryConnectorPart`.
     * @param ctx the parse tree
     */
    enterNaryConnectorPart?: (ctx: NaryConnectorPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.naryConnectorPart`.
     * @param ctx the parse tree
     */
    exitNaryConnectorPart?: (ctx: NaryConnectorPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.bindingConnectorAsUsage`.
     * @param ctx the parse tree
     */
    enterBindingConnectorAsUsage?: (ctx: BindingConnectorAsUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.bindingConnectorAsUsage`.
     * @param ctx the parse tree
     */
    exitBindingConnectorAsUsage?: (ctx: BindingConnectorAsUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.successionAsUsage`.
     * @param ctx the parse tree
     */
    enterSuccessionAsUsage?: (ctx: SuccessionAsUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.successionAsUsage`.
     * @param ctx the parse tree
     */
    exitSuccessionAsUsage?: (ctx: SuccessionAsUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceDefinition`.
     * @param ctx the parse tree
     */
    enterInterfaceDefinition?: (ctx: InterfaceDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceDefinition`.
     * @param ctx the parse tree
     */
    exitInterfaceDefinition?: (ctx: InterfaceDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceBody`.
     * @param ctx the parse tree
     */
    enterInterfaceBody?: (ctx: InterfaceBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceBody`.
     * @param ctx the parse tree
     */
    exitInterfaceBody?: (ctx: InterfaceBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceBodyItem`.
     * @param ctx the parse tree
     */
    enterInterfaceBodyItem?: (ctx: InterfaceBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceBodyItem`.
     * @param ctx the parse tree
     */
    exitInterfaceBodyItem?: (ctx: InterfaceBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceNonOccurrenceUsageMember`.
     * @param ctx the parse tree
     */
    enterInterfaceNonOccurrenceUsageMember?: (ctx: InterfaceNonOccurrenceUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceNonOccurrenceUsageMember`.
     * @param ctx the parse tree
     */
    exitInterfaceNonOccurrenceUsageMember?: (ctx: InterfaceNonOccurrenceUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceNonOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    enterInterfaceNonOccurrenceUsageElement?: (ctx: InterfaceNonOccurrenceUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceNonOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    exitInterfaceNonOccurrenceUsageElement?: (ctx: InterfaceNonOccurrenceUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceOccurrenceUsageMember`.
     * @param ctx the parse tree
     */
    enterInterfaceOccurrenceUsageMember?: (ctx: InterfaceOccurrenceUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceOccurrenceUsageMember`.
     * @param ctx the parse tree
     */
    exitInterfaceOccurrenceUsageMember?: (ctx: InterfaceOccurrenceUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    enterInterfaceOccurrenceUsageElement?: (ctx: InterfaceOccurrenceUsageElementContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceOccurrenceUsageElement`.
     * @param ctx the parse tree
     */
    exitInterfaceOccurrenceUsageElement?: (ctx: InterfaceOccurrenceUsageElementContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.defaultInterfaceEnd`.
     * @param ctx the parse tree
     */
    enterDefaultInterfaceEnd?: (ctx: DefaultInterfaceEndContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.defaultInterfaceEnd`.
     * @param ctx the parse tree
     */
    exitDefaultInterfaceEnd?: (ctx: DefaultInterfaceEndContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceUsage`.
     * @param ctx the parse tree
     */
    enterInterfaceUsage?: (ctx: InterfaceUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceUsage`.
     * @param ctx the parse tree
     */
    exitInterfaceUsage?: (ctx: InterfaceUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceUsageDeclaration`.
     * @param ctx the parse tree
     */
    enterInterfaceUsageDeclaration?: (ctx: InterfaceUsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceUsageDeclaration`.
     * @param ctx the parse tree
     */
    exitInterfaceUsageDeclaration?: (ctx: InterfaceUsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfacePart`.
     * @param ctx the parse tree
     */
    enterInterfacePart?: (ctx: InterfacePartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfacePart`.
     * @param ctx the parse tree
     */
    exitInterfacePart?: (ctx: InterfacePartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.binaryInterfacePart`.
     * @param ctx the parse tree
     */
    enterBinaryInterfacePart?: (ctx: BinaryInterfacePartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.binaryInterfacePart`.
     * @param ctx the parse tree
     */
    exitBinaryInterfacePart?: (ctx: BinaryInterfacePartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.naryInterfacePart`.
     * @param ctx the parse tree
     */
    enterNaryInterfacePart?: (ctx: NaryInterfacePartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.naryInterfacePart`.
     * @param ctx the parse tree
     */
    exitNaryInterfacePart?: (ctx: NaryInterfacePartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceEndMember`.
     * @param ctx the parse tree
     */
    enterInterfaceEndMember?: (ctx: InterfaceEndMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceEndMember`.
     * @param ctx the parse tree
     */
    exitInterfaceEndMember?: (ctx: InterfaceEndMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.interfaceEnd`.
     * @param ctx the parse tree
     */
    enterInterfaceEnd?: (ctx: InterfaceEndContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.interfaceEnd`.
     * @param ctx the parse tree
     */
    exitInterfaceEnd?: (ctx: InterfaceEndContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.allocationDefinition`.
     * @param ctx the parse tree
     */
    enterAllocationDefinition?: (ctx: AllocationDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.allocationDefinition`.
     * @param ctx the parse tree
     */
    exitAllocationDefinition?: (ctx: AllocationDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.allocationUsage`.
     * @param ctx the parse tree
     */
    enterAllocationUsage?: (ctx: AllocationUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.allocationUsage`.
     * @param ctx the parse tree
     */
    exitAllocationUsage?: (ctx: AllocationUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.allocationUsageDeclaration`.
     * @param ctx the parse tree
     */
    enterAllocationUsageDeclaration?: (ctx: AllocationUsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.allocationUsageDeclaration`.
     * @param ctx the parse tree
     */
    exitAllocationUsageDeclaration?: (ctx: AllocationUsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flowDefinition`.
     * @param ctx the parse tree
     */
    enterFlowDefinition?: (ctx: FlowDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flowDefinition`.
     * @param ctx the parse tree
     */
    exitFlowDefinition?: (ctx: FlowDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.message`.
     * @param ctx the parse tree
     */
    enterMessage?: (ctx: MessageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.message`.
     * @param ctx the parse tree
     */
    exitMessage?: (ctx: MessageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.messageDeclaration`.
     * @param ctx the parse tree
     */
    enterMessageDeclaration?: (ctx: MessageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.messageDeclaration`.
     * @param ctx the parse tree
     */
    exitMessageDeclaration?: (ctx: MessageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.messageEventMember`.
     * @param ctx the parse tree
     */
    enterMessageEventMember?: (ctx: MessageEventMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.messageEventMember`.
     * @param ctx the parse tree
     */
    exitMessageEventMember?: (ctx: MessageEventMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.messageEvent`.
     * @param ctx the parse tree
     */
    enterMessageEvent?: (ctx: MessageEventContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.messageEvent`.
     * @param ctx the parse tree
     */
    exitMessageEvent?: (ctx: MessageEventContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flowUsage`.
     * @param ctx the parse tree
     */
    enterFlowUsage?: (ctx: FlowUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flowUsage`.
     * @param ctx the parse tree
     */
    exitFlowUsage?: (ctx: FlowUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.successionFlowUsage`.
     * @param ctx the parse tree
     */
    enterSuccessionFlowUsage?: (ctx: SuccessionFlowUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.successionFlowUsage`.
     * @param ctx the parse tree
     */
    exitSuccessionFlowUsage?: (ctx: SuccessionFlowUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flowPayloadFeatureMember`.
     * @param ctx the parse tree
     */
    enterFlowPayloadFeatureMember?: (ctx: FlowPayloadFeatureMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flowPayloadFeatureMember`.
     * @param ctx the parse tree
     */
    exitFlowPayloadFeatureMember?: (ctx: FlowPayloadFeatureMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.flowPayloadFeature`.
     * @param ctx the parse tree
     */
    enterFlowPayloadFeature?: (ctx: FlowPayloadFeatureContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.flowPayloadFeature`.
     * @param ctx the parse tree
     */
    exitFlowPayloadFeature?: (ctx: FlowPayloadFeatureContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionDefinition`.
     * @param ctx the parse tree
     */
    enterActionDefinition?: (ctx: ActionDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionDefinition`.
     * @param ctx the parse tree
     */
    exitActionDefinition?: (ctx: ActionDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionBody`.
     * @param ctx the parse tree
     */
    enterActionBody?: (ctx: ActionBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionBody`.
     * @param ctx the parse tree
     */
    exitActionBody?: (ctx: ActionBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionBodyItem`.
     * @param ctx the parse tree
     */
    enterActionBodyItem?: (ctx: ActionBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionBodyItem`.
     * @param ctx the parse tree
     */
    exitActionBodyItem?: (ctx: ActionBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nonBehaviorBodyItem`.
     * @param ctx the parse tree
     */
    enterNonBehaviorBodyItem?: (ctx: NonBehaviorBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nonBehaviorBodyItem`.
     * @param ctx the parse tree
     */
    exitNonBehaviorBodyItem?: (ctx: NonBehaviorBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionBehaviorMember`.
     * @param ctx the parse tree
     */
    enterActionBehaviorMember?: (ctx: ActionBehaviorMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionBehaviorMember`.
     * @param ctx the parse tree
     */
    exitActionBehaviorMember?: (ctx: ActionBehaviorMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.initialNodeMember`.
     * @param ctx the parse tree
     */
    enterInitialNodeMember?: (ctx: InitialNodeMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.initialNodeMember`.
     * @param ctx the parse tree
     */
    exitInitialNodeMember?: (ctx: InitialNodeMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionNodeMember`.
     * @param ctx the parse tree
     */
    enterActionNodeMember?: (ctx: ActionNodeMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionNodeMember`.
     * @param ctx the parse tree
     */
    exitActionNodeMember?: (ctx: ActionNodeMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionTargetSuccessionMember`.
     * @param ctx the parse tree
     */
    enterActionTargetSuccessionMember?: (ctx: ActionTargetSuccessionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionTargetSuccessionMember`.
     * @param ctx the parse tree
     */
    exitActionTargetSuccessionMember?: (ctx: ActionTargetSuccessionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.guardedSuccessionMember`.
     * @param ctx the parse tree
     */
    enterGuardedSuccessionMember?: (ctx: GuardedSuccessionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.guardedSuccessionMember`.
     * @param ctx the parse tree
     */
    exitGuardedSuccessionMember?: (ctx: GuardedSuccessionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionUsage`.
     * @param ctx the parse tree
     */
    enterActionUsage?: (ctx: ActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionUsage`.
     * @param ctx the parse tree
     */
    exitActionUsage?: (ctx: ActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionUsageDeclaration`.
     * @param ctx the parse tree
     */
    enterActionUsageDeclaration?: (ctx: ActionUsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionUsageDeclaration`.
     * @param ctx the parse tree
     */
    exitActionUsageDeclaration?: (ctx: ActionUsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.performActionUsage`.
     * @param ctx the parse tree
     */
    enterPerformActionUsage?: (ctx: PerformActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.performActionUsage`.
     * @param ctx the parse tree
     */
    exitPerformActionUsage?: (ctx: PerformActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.performActionUsageDeclaration`.
     * @param ctx the parse tree
     */
    enterPerformActionUsageDeclaration?: (ctx: PerformActionUsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.performActionUsageDeclaration`.
     * @param ctx the parse tree
     */
    exitPerformActionUsageDeclaration?: (ctx: PerformActionUsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionNode`.
     * @param ctx the parse tree
     */
    enterActionNode?: (ctx: ActionNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionNode`.
     * @param ctx the parse tree
     */
    exitActionNode?: (ctx: ActionNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionNodeUsageDeclaration`.
     * @param ctx the parse tree
     */
    enterActionNodeUsageDeclaration?: (ctx: ActionNodeUsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionNodeUsageDeclaration`.
     * @param ctx the parse tree
     */
    exitActionNodeUsageDeclaration?: (ctx: ActionNodeUsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionNodePrefix`.
     * @param ctx the parse tree
     */
    enterActionNodePrefix?: (ctx: ActionNodePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionNodePrefix`.
     * @param ctx the parse tree
     */
    exitActionNodePrefix?: (ctx: ActionNodePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.controlNode`.
     * @param ctx the parse tree
     */
    enterControlNode?: (ctx: ControlNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.controlNode`.
     * @param ctx the parse tree
     */
    exitControlNode?: (ctx: ControlNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.controlNodePrefix`.
     * @param ctx the parse tree
     */
    enterControlNodePrefix?: (ctx: ControlNodePrefixContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.controlNodePrefix`.
     * @param ctx the parse tree
     */
    exitControlNodePrefix?: (ctx: ControlNodePrefixContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.mergeNode`.
     * @param ctx the parse tree
     */
    enterMergeNode?: (ctx: MergeNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.mergeNode`.
     * @param ctx the parse tree
     */
    exitMergeNode?: (ctx: MergeNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.decisionNode`.
     * @param ctx the parse tree
     */
    enterDecisionNode?: (ctx: DecisionNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.decisionNode`.
     * @param ctx the parse tree
     */
    exitDecisionNode?: (ctx: DecisionNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.joinNode`.
     * @param ctx the parse tree
     */
    enterJoinNode?: (ctx: JoinNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.joinNode`.
     * @param ctx the parse tree
     */
    exitJoinNode?: (ctx: JoinNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.forkNode`.
     * @param ctx the parse tree
     */
    enterForkNode?: (ctx: ForkNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.forkNode`.
     * @param ctx the parse tree
     */
    exitForkNode?: (ctx: ForkNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.acceptNode`.
     * @param ctx the parse tree
     */
    enterAcceptNode?: (ctx: AcceptNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.acceptNode`.
     * @param ctx the parse tree
     */
    exitAcceptNode?: (ctx: AcceptNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.acceptNodeDeclaration`.
     * @param ctx the parse tree
     */
    enterAcceptNodeDeclaration?: (ctx: AcceptNodeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.acceptNodeDeclaration`.
     * @param ctx the parse tree
     */
    exitAcceptNodeDeclaration?: (ctx: AcceptNodeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.acceptParameterPart`.
     * @param ctx the parse tree
     */
    enterAcceptParameterPart?: (ctx: AcceptParameterPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.acceptParameterPart`.
     * @param ctx the parse tree
     */
    exitAcceptParameterPart?: (ctx: AcceptParameterPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.payloadParameterMember`.
     * @param ctx the parse tree
     */
    enterPayloadParameterMember?: (ctx: PayloadParameterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.payloadParameterMember`.
     * @param ctx the parse tree
     */
    exitPayloadParameterMember?: (ctx: PayloadParameterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.payloadParameter`.
     * @param ctx the parse tree
     */
    enterPayloadParameter?: (ctx: PayloadParameterContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.payloadParameter`.
     * @param ctx the parse tree
     */
    exitPayloadParameter?: (ctx: PayloadParameterContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.triggerValuePart`.
     * @param ctx the parse tree
     */
    enterTriggerValuePart?: (ctx: TriggerValuePartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.triggerValuePart`.
     * @param ctx the parse tree
     */
    exitTriggerValuePart?: (ctx: TriggerValuePartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.triggerFeatureValue`.
     * @param ctx the parse tree
     */
    enterTriggerFeatureValue?: (ctx: TriggerFeatureValueContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.triggerFeatureValue`.
     * @param ctx the parse tree
     */
    exitTriggerFeatureValue?: (ctx: TriggerFeatureValueContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.triggerExpression`.
     * @param ctx the parse tree
     */
    enterTriggerExpression?: (ctx: TriggerExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.triggerExpression`.
     * @param ctx the parse tree
     */
    exitTriggerExpression?: (ctx: TriggerExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.sendNode`.
     * @param ctx the parse tree
     */
    enterSendNode?: (ctx: SendNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.sendNode`.
     * @param ctx the parse tree
     */
    exitSendNode?: (ctx: SendNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.sendNodeDeclaration`.
     * @param ctx the parse tree
     */
    enterSendNodeDeclaration?: (ctx: SendNodeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.sendNodeDeclaration`.
     * @param ctx the parse tree
     */
    exitSendNodeDeclaration?: (ctx: SendNodeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.senderReceiverPart`.
     * @param ctx the parse tree
     */
    enterSenderReceiverPart?: (ctx: SenderReceiverPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.senderReceiverPart`.
     * @param ctx the parse tree
     */
    exitSenderReceiverPart?: (ctx: SenderReceiverPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nodeParameterMember`.
     * @param ctx the parse tree
     */
    enterNodeParameterMember?: (ctx: NodeParameterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nodeParameterMember`.
     * @param ctx the parse tree
     */
    exitNodeParameterMember?: (ctx: NodeParameterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nodeParameter`.
     * @param ctx the parse tree
     */
    enterNodeParameter?: (ctx: NodeParameterContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nodeParameter`.
     * @param ctx the parse tree
     */
    exitNodeParameter?: (ctx: NodeParameterContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.featureBinding`.
     * @param ctx the parse tree
     */
    enterFeatureBinding?: (ctx: FeatureBindingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.featureBinding`.
     * @param ctx the parse tree
     */
    exitFeatureBinding?: (ctx: FeatureBindingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.emptyParameterMember`.
     * @param ctx the parse tree
     */
    enterEmptyParameterMember?: (ctx: EmptyParameterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.emptyParameterMember`.
     * @param ctx the parse tree
     */
    exitEmptyParameterMember?: (ctx: EmptyParameterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.assignmentNode`.
     * @param ctx the parse tree
     */
    enterAssignmentNode?: (ctx: AssignmentNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.assignmentNode`.
     * @param ctx the parse tree
     */
    exitAssignmentNode?: (ctx: AssignmentNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.assignmentNodeDeclaration`.
     * @param ctx the parse tree
     */
    enterAssignmentNodeDeclaration?: (ctx: AssignmentNodeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.assignmentNodeDeclaration`.
     * @param ctx the parse tree
     */
    exitAssignmentNodeDeclaration?: (ctx: AssignmentNodeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.assignmentTargetMember`.
     * @param ctx the parse tree
     */
    enterAssignmentTargetMember?: (ctx: AssignmentTargetMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.assignmentTargetMember`.
     * @param ctx the parse tree
     */
    exitAssignmentTargetMember?: (ctx: AssignmentTargetMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.assignmentTargetParameter`.
     * @param ctx the parse tree
     */
    enterAssignmentTargetParameter?: (ctx: AssignmentTargetParameterContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.assignmentTargetParameter`.
     * @param ctx the parse tree
     */
    exitAssignmentTargetParameter?: (ctx: AssignmentTargetParameterContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.assignmentTargetBinding`.
     * @param ctx the parse tree
     */
    enterAssignmentTargetBinding?: (ctx: AssignmentTargetBindingContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.assignmentTargetBinding`.
     * @param ctx the parse tree
     */
    exitAssignmentTargetBinding?: (ctx: AssignmentTargetBindingContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.terminateNode`.
     * @param ctx the parse tree
     */
    enterTerminateNode?: (ctx: TerminateNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.terminateNode`.
     * @param ctx the parse tree
     */
    exitTerminateNode?: (ctx: TerminateNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ifNode`.
     * @param ctx the parse tree
     */
    enterIfNode?: (ctx: IfNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ifNode`.
     * @param ctx the parse tree
     */
    exitIfNode?: (ctx: IfNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.expressionParameterMember`.
     * @param ctx the parse tree
     */
    enterExpressionParameterMember?: (ctx: ExpressionParameterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.expressionParameterMember`.
     * @param ctx the parse tree
     */
    exitExpressionParameterMember?: (ctx: ExpressionParameterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionBodyParameterMember`.
     * @param ctx the parse tree
     */
    enterActionBodyParameterMember?: (ctx: ActionBodyParameterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionBodyParameterMember`.
     * @param ctx the parse tree
     */
    exitActionBodyParameterMember?: (ctx: ActionBodyParameterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionBodyParameter`.
     * @param ctx the parse tree
     */
    enterActionBodyParameter?: (ctx: ActionBodyParameterContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionBodyParameter`.
     * @param ctx the parse tree
     */
    exitActionBodyParameter?: (ctx: ActionBodyParameterContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.ifNodeParameterMember`.
     * @param ctx the parse tree
     */
    enterIfNodeParameterMember?: (ctx: IfNodeParameterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.ifNodeParameterMember`.
     * @param ctx the parse tree
     */
    exitIfNodeParameterMember?: (ctx: IfNodeParameterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.whileLoopNode`.
     * @param ctx the parse tree
     */
    enterWhileLoopNode?: (ctx: WhileLoopNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.whileLoopNode`.
     * @param ctx the parse tree
     */
    exitWhileLoopNode?: (ctx: WhileLoopNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.forLoopNode`.
     * @param ctx the parse tree
     */
    enterForLoopNode?: (ctx: ForLoopNodeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.forLoopNode`.
     * @param ctx the parse tree
     */
    exitForLoopNode?: (ctx: ForLoopNodeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.forVariableDeclarationMember`.
     * @param ctx the parse tree
     */
    enterForVariableDeclarationMember?: (ctx: ForVariableDeclarationMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.forVariableDeclarationMember`.
     * @param ctx the parse tree
     */
    exitForVariableDeclarationMember?: (ctx: ForVariableDeclarationMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actionTargetSuccession`.
     * @param ctx the parse tree
     */
    enterActionTargetSuccession?: (ctx: ActionTargetSuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actionTargetSuccession`.
     * @param ctx the parse tree
     */
    exitActionTargetSuccession?: (ctx: ActionTargetSuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.targetSuccession`.
     * @param ctx the parse tree
     */
    enterTargetSuccession?: (ctx: TargetSuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.targetSuccession`.
     * @param ctx the parse tree
     */
    exitTargetSuccession?: (ctx: TargetSuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.guardedTargetSuccession`.
     * @param ctx the parse tree
     */
    enterGuardedTargetSuccession?: (ctx: GuardedTargetSuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.guardedTargetSuccession`.
     * @param ctx the parse tree
     */
    exitGuardedTargetSuccession?: (ctx: GuardedTargetSuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.defaultTargetSuccession`.
     * @param ctx the parse tree
     */
    enterDefaultTargetSuccession?: (ctx: DefaultTargetSuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.defaultTargetSuccession`.
     * @param ctx the parse tree
     */
    exitDefaultTargetSuccession?: (ctx: DefaultTargetSuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.guardedSuccession`.
     * @param ctx the parse tree
     */
    enterGuardedSuccession?: (ctx: GuardedSuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.guardedSuccession`.
     * @param ctx the parse tree
     */
    exitGuardedSuccession?: (ctx: GuardedSuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateDefinition`.
     * @param ctx the parse tree
     */
    enterStateDefinition?: (ctx: StateDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateDefinition`.
     * @param ctx the parse tree
     */
    exitStateDefinition?: (ctx: StateDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateDefBody`.
     * @param ctx the parse tree
     */
    enterStateDefBody?: (ctx: StateDefBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateDefBody`.
     * @param ctx the parse tree
     */
    exitStateDefBody?: (ctx: StateDefBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateBodyItem`.
     * @param ctx the parse tree
     */
    enterStateBodyItem?: (ctx: StateBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateBodyItem`.
     * @param ctx the parse tree
     */
    exitStateBodyItem?: (ctx: StateBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.entryActionMember`.
     * @param ctx the parse tree
     */
    enterEntryActionMember?: (ctx: EntryActionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.entryActionMember`.
     * @param ctx the parse tree
     */
    exitEntryActionMember?: (ctx: EntryActionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.doActionMember`.
     * @param ctx the parse tree
     */
    enterDoActionMember?: (ctx: DoActionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.doActionMember`.
     * @param ctx the parse tree
     */
    exitDoActionMember?: (ctx: DoActionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.exitActionMember`.
     * @param ctx the parse tree
     */
    enterExitActionMember?: (ctx: ExitActionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.exitActionMember`.
     * @param ctx the parse tree
     */
    exitExitActionMember?: (ctx: ExitActionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.entryTransitionMember`.
     * @param ctx the parse tree
     */
    enterEntryTransitionMember?: (ctx: EntryTransitionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.entryTransitionMember`.
     * @param ctx the parse tree
     */
    exitEntryTransitionMember?: (ctx: EntryTransitionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateActionUsage`.
     * @param ctx the parse tree
     */
    enterStateActionUsage?: (ctx: StateActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateActionUsage`.
     * @param ctx the parse tree
     */
    exitStateActionUsage?: (ctx: StateActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.statePerformActionUsage`.
     * @param ctx the parse tree
     */
    enterStatePerformActionUsage?: (ctx: StatePerformActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.statePerformActionUsage`.
     * @param ctx the parse tree
     */
    exitStatePerformActionUsage?: (ctx: StatePerformActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateAcceptActionUsage`.
     * @param ctx the parse tree
     */
    enterStateAcceptActionUsage?: (ctx: StateAcceptActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateAcceptActionUsage`.
     * @param ctx the parse tree
     */
    exitStateAcceptActionUsage?: (ctx: StateAcceptActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateSendActionUsage`.
     * @param ctx the parse tree
     */
    enterStateSendActionUsage?: (ctx: StateSendActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateSendActionUsage`.
     * @param ctx the parse tree
     */
    exitStateSendActionUsage?: (ctx: StateSendActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateAssignmentActionUsage`.
     * @param ctx the parse tree
     */
    enterStateAssignmentActionUsage?: (ctx: StateAssignmentActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateAssignmentActionUsage`.
     * @param ctx the parse tree
     */
    exitStateAssignmentActionUsage?: (ctx: StateAssignmentActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionUsageMember`.
     * @param ctx the parse tree
     */
    enterTransitionUsageMember?: (ctx: TransitionUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionUsageMember`.
     * @param ctx the parse tree
     */
    exitTransitionUsageMember?: (ctx: TransitionUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.targetTransitionUsageMember`.
     * @param ctx the parse tree
     */
    enterTargetTransitionUsageMember?: (ctx: TargetTransitionUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.targetTransitionUsageMember`.
     * @param ctx the parse tree
     */
    exitTargetTransitionUsageMember?: (ctx: TargetTransitionUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateUsage`.
     * @param ctx the parse tree
     */
    enterStateUsage?: (ctx: StateUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateUsage`.
     * @param ctx the parse tree
     */
    exitStateUsage?: (ctx: StateUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stateUsageBody`.
     * @param ctx the parse tree
     */
    enterStateUsageBody?: (ctx: StateUsageBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stateUsageBody`.
     * @param ctx the parse tree
     */
    exitStateUsageBody?: (ctx: StateUsageBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.exhibitStateUsage`.
     * @param ctx the parse tree
     */
    enterExhibitStateUsage?: (ctx: ExhibitStateUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.exhibitStateUsage`.
     * @param ctx the parse tree
     */
    exitExhibitStateUsage?: (ctx: ExhibitStateUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionUsage`.
     * @param ctx the parse tree
     */
    enterTransitionUsage?: (ctx: TransitionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionUsage`.
     * @param ctx the parse tree
     */
    exitTransitionUsage?: (ctx: TransitionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.targetTransitionUsage`.
     * @param ctx the parse tree
     */
    enterTargetTransitionUsage?: (ctx: TargetTransitionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.targetTransitionUsage`.
     * @param ctx the parse tree
     */
    exitTargetTransitionUsage?: (ctx: TargetTransitionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.triggerActionMember`.
     * @param ctx the parse tree
     */
    enterTriggerActionMember?: (ctx: TriggerActionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.triggerActionMember`.
     * @param ctx the parse tree
     */
    exitTriggerActionMember?: (ctx: TriggerActionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.triggerAction`.
     * @param ctx the parse tree
     */
    enterTriggerAction?: (ctx: TriggerActionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.triggerAction`.
     * @param ctx the parse tree
     */
    exitTriggerAction?: (ctx: TriggerActionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.guardExpressionMember`.
     * @param ctx the parse tree
     */
    enterGuardExpressionMember?: (ctx: GuardExpressionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.guardExpressionMember`.
     * @param ctx the parse tree
     */
    exitGuardExpressionMember?: (ctx: GuardExpressionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.effectBehaviorMember`.
     * @param ctx the parse tree
     */
    enterEffectBehaviorMember?: (ctx: EffectBehaviorMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.effectBehaviorMember`.
     * @param ctx the parse tree
     */
    exitEffectBehaviorMember?: (ctx: EffectBehaviorMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.effectBehaviorUsage`.
     * @param ctx the parse tree
     */
    enterEffectBehaviorUsage?: (ctx: EffectBehaviorUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.effectBehaviorUsage`.
     * @param ctx the parse tree
     */
    exitEffectBehaviorUsage?: (ctx: EffectBehaviorUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionPerformActionUsage`.
     * @param ctx the parse tree
     */
    enterTransitionPerformActionUsage?: (ctx: TransitionPerformActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionPerformActionUsage`.
     * @param ctx the parse tree
     */
    exitTransitionPerformActionUsage?: (ctx: TransitionPerformActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionAcceptActionUsage`.
     * @param ctx the parse tree
     */
    enterTransitionAcceptActionUsage?: (ctx: TransitionAcceptActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionAcceptActionUsage`.
     * @param ctx the parse tree
     */
    exitTransitionAcceptActionUsage?: (ctx: TransitionAcceptActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionSendActionUsage`.
     * @param ctx the parse tree
     */
    enterTransitionSendActionUsage?: (ctx: TransitionSendActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionSendActionUsage`.
     * @param ctx the parse tree
     */
    exitTransitionSendActionUsage?: (ctx: TransitionSendActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionAssignmentActionUsage`.
     * @param ctx the parse tree
     */
    enterTransitionAssignmentActionUsage?: (ctx: TransitionAssignmentActionUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionAssignmentActionUsage`.
     * @param ctx the parse tree
     */
    exitTransitionAssignmentActionUsage?: (ctx: TransitionAssignmentActionUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionSuccessionMember`.
     * @param ctx the parse tree
     */
    enterTransitionSuccessionMember?: (ctx: TransitionSuccessionMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionSuccessionMember`.
     * @param ctx the parse tree
     */
    exitTransitionSuccessionMember?: (ctx: TransitionSuccessionMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.transitionSuccession`.
     * @param ctx the parse tree
     */
    enterTransitionSuccession?: (ctx: TransitionSuccessionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.transitionSuccession`.
     * @param ctx the parse tree
     */
    exitTransitionSuccession?: (ctx: TransitionSuccessionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.emptyEndMember`.
     * @param ctx the parse tree
     */
    enterEmptyEndMember?: (ctx: EmptyEndMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.emptyEndMember`.
     * @param ctx the parse tree
     */
    exitEmptyEndMember?: (ctx: EmptyEndMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.calculationDefinition`.
     * @param ctx the parse tree
     */
    enterCalculationDefinition?: (ctx: CalculationDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.calculationDefinition`.
     * @param ctx the parse tree
     */
    exitCalculationDefinition?: (ctx: CalculationDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.calculationUsage`.
     * @param ctx the parse tree
     */
    enterCalculationUsage?: (ctx: CalculationUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.calculationUsage`.
     * @param ctx the parse tree
     */
    exitCalculationUsage?: (ctx: CalculationUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.calculationBody`.
     * @param ctx the parse tree
     */
    enterCalculationBody?: (ctx: CalculationBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.calculationBody`.
     * @param ctx the parse tree
     */
    exitCalculationBody?: (ctx: CalculationBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.calculationBodyPart`.
     * @param ctx the parse tree
     */
    enterCalculationBodyPart?: (ctx: CalculationBodyPartContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.calculationBodyPart`.
     * @param ctx the parse tree
     */
    exitCalculationBodyPart?: (ctx: CalculationBodyPartContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.calculationBodyItem`.
     * @param ctx the parse tree
     */
    enterCalculationBodyItem?: (ctx: CalculationBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.calculationBodyItem`.
     * @param ctx the parse tree
     */
    exitCalculationBodyItem?: (ctx: CalculationBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.returnParameterMember`.
     * @param ctx the parse tree
     */
    enterReturnParameterMember?: (ctx: ReturnParameterMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.returnParameterMember`.
     * @param ctx the parse tree
     */
    exitReturnParameterMember?: (ctx: ReturnParameterMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.constraintDefinition`.
     * @param ctx the parse tree
     */
    enterConstraintDefinition?: (ctx: ConstraintDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.constraintDefinition`.
     * @param ctx the parse tree
     */
    exitConstraintDefinition?: (ctx: ConstraintDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.constraintUsage`.
     * @param ctx the parse tree
     */
    enterConstraintUsage?: (ctx: ConstraintUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.constraintUsage`.
     * @param ctx the parse tree
     */
    exitConstraintUsage?: (ctx: ConstraintUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.assertConstraintUsage`.
     * @param ctx the parse tree
     */
    enterAssertConstraintUsage?: (ctx: AssertConstraintUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.assertConstraintUsage`.
     * @param ctx the parse tree
     */
    exitAssertConstraintUsage?: (ctx: AssertConstraintUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.constraintUsageDeclaration`.
     * @param ctx the parse tree
     */
    enterConstraintUsageDeclaration?: (ctx: ConstraintUsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.constraintUsageDeclaration`.
     * @param ctx the parse tree
     */
    exitConstraintUsageDeclaration?: (ctx: ConstraintUsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementDefinition`.
     * @param ctx the parse tree
     */
    enterRequirementDefinition?: (ctx: RequirementDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementDefinition`.
     * @param ctx the parse tree
     */
    exitRequirementDefinition?: (ctx: RequirementDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementBody`.
     * @param ctx the parse tree
     */
    enterRequirementBody?: (ctx: RequirementBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementBody`.
     * @param ctx the parse tree
     */
    exitRequirementBody?: (ctx: RequirementBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementBodyItem`.
     * @param ctx the parse tree
     */
    enterRequirementBodyItem?: (ctx: RequirementBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementBodyItem`.
     * @param ctx the parse tree
     */
    exitRequirementBodyItem?: (ctx: RequirementBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.subjectMember`.
     * @param ctx the parse tree
     */
    enterSubjectMember?: (ctx: SubjectMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.subjectMember`.
     * @param ctx the parse tree
     */
    exitSubjectMember?: (ctx: SubjectMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.subjectUsage`.
     * @param ctx the parse tree
     */
    enterSubjectUsage?: (ctx: SubjectUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.subjectUsage`.
     * @param ctx the parse tree
     */
    exitSubjectUsage?: (ctx: SubjectUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementConstraintMember`.
     * @param ctx the parse tree
     */
    enterRequirementConstraintMember?: (ctx: RequirementConstraintMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementConstraintMember`.
     * @param ctx the parse tree
     */
    exitRequirementConstraintMember?: (ctx: RequirementConstraintMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementKind`.
     * @param ctx the parse tree
     */
    enterRequirementKind?: (ctx: RequirementKindContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementKind`.
     * @param ctx the parse tree
     */
    exitRequirementKind?: (ctx: RequirementKindContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementConstraintUsage`.
     * @param ctx the parse tree
     */
    enterRequirementConstraintUsage?: (ctx: RequirementConstraintUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementConstraintUsage`.
     * @param ctx the parse tree
     */
    exitRequirementConstraintUsage?: (ctx: RequirementConstraintUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.framedConcernMember`.
     * @param ctx the parse tree
     */
    enterFramedConcernMember?: (ctx: FramedConcernMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.framedConcernMember`.
     * @param ctx the parse tree
     */
    exitFramedConcernMember?: (ctx: FramedConcernMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.framedConcernUsage`.
     * @param ctx the parse tree
     */
    enterFramedConcernUsage?: (ctx: FramedConcernUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.framedConcernUsage`.
     * @param ctx the parse tree
     */
    exitFramedConcernUsage?: (ctx: FramedConcernUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actorMember`.
     * @param ctx the parse tree
     */
    enterActorMember?: (ctx: ActorMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actorMember`.
     * @param ctx the parse tree
     */
    exitActorMember?: (ctx: ActorMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.actorUsage`.
     * @param ctx the parse tree
     */
    enterActorUsage?: (ctx: ActorUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.actorUsage`.
     * @param ctx the parse tree
     */
    exitActorUsage?: (ctx: ActorUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stakeholderMember`.
     * @param ctx the parse tree
     */
    enterStakeholderMember?: (ctx: StakeholderMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stakeholderMember`.
     * @param ctx the parse tree
     */
    exitStakeholderMember?: (ctx: StakeholderMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.stakeholderUsage`.
     * @param ctx the parse tree
     */
    enterStakeholderUsage?: (ctx: StakeholderUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.stakeholderUsage`.
     * @param ctx the parse tree
     */
    exitStakeholderUsage?: (ctx: StakeholderUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementUsage`.
     * @param ctx the parse tree
     */
    enterRequirementUsage?: (ctx: RequirementUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementUsage`.
     * @param ctx the parse tree
     */
    exitRequirementUsage?: (ctx: RequirementUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.satisfyRequirementUsage`.
     * @param ctx the parse tree
     */
    enterSatisfyRequirementUsage?: (ctx: SatisfyRequirementUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.satisfyRequirementUsage`.
     * @param ctx the parse tree
     */
    exitSatisfyRequirementUsage?: (ctx: SatisfyRequirementUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.satisfactionSubjectMember`.
     * @param ctx the parse tree
     */
    enterSatisfactionSubjectMember?: (ctx: SatisfactionSubjectMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.satisfactionSubjectMember`.
     * @param ctx the parse tree
     */
    exitSatisfactionSubjectMember?: (ctx: SatisfactionSubjectMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.satisfactionParameter`.
     * @param ctx the parse tree
     */
    enterSatisfactionParameter?: (ctx: SatisfactionParameterContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.satisfactionParameter`.
     * @param ctx the parse tree
     */
    exitSatisfactionParameter?: (ctx: SatisfactionParameterContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.satisfactionFeatureValue`.
     * @param ctx the parse tree
     */
    enterSatisfactionFeatureValue?: (ctx: SatisfactionFeatureValueContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.satisfactionFeatureValue`.
     * @param ctx the parse tree
     */
    exitSatisfactionFeatureValue?: (ctx: SatisfactionFeatureValueContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.satisfactionReferenceExpression`.
     * @param ctx the parse tree
     */
    enterSatisfactionReferenceExpression?: (ctx: SatisfactionReferenceExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.satisfactionReferenceExpression`.
     * @param ctx the parse tree
     */
    exitSatisfactionReferenceExpression?: (ctx: SatisfactionReferenceExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.concernDefinition`.
     * @param ctx the parse tree
     */
    enterConcernDefinition?: (ctx: ConcernDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.concernDefinition`.
     * @param ctx the parse tree
     */
    exitConcernDefinition?: (ctx: ConcernDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.concernUsage`.
     * @param ctx the parse tree
     */
    enterConcernUsage?: (ctx: ConcernUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.concernUsage`.
     * @param ctx the parse tree
     */
    exitConcernUsage?: (ctx: ConcernUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.caseDefinition`.
     * @param ctx the parse tree
     */
    enterCaseDefinition?: (ctx: CaseDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.caseDefinition`.
     * @param ctx the parse tree
     */
    exitCaseDefinition?: (ctx: CaseDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.caseUsage`.
     * @param ctx the parse tree
     */
    enterCaseUsage?: (ctx: CaseUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.caseUsage`.
     * @param ctx the parse tree
     */
    exitCaseUsage?: (ctx: CaseUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.caseBody`.
     * @param ctx the parse tree
     */
    enterCaseBody?: (ctx: CaseBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.caseBody`.
     * @param ctx the parse tree
     */
    exitCaseBody?: (ctx: CaseBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.caseBodyItem`.
     * @param ctx the parse tree
     */
    enterCaseBodyItem?: (ctx: CaseBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.caseBodyItem`.
     * @param ctx the parse tree
     */
    exitCaseBodyItem?: (ctx: CaseBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.objectiveMember`.
     * @param ctx the parse tree
     */
    enterObjectiveMember?: (ctx: ObjectiveMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.objectiveMember`.
     * @param ctx the parse tree
     */
    exitObjectiveMember?: (ctx: ObjectiveMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.objectiveRequirementUsage`.
     * @param ctx the parse tree
     */
    enterObjectiveRequirementUsage?: (ctx: ObjectiveRequirementUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.objectiveRequirementUsage`.
     * @param ctx the parse tree
     */
    exitObjectiveRequirementUsage?: (ctx: ObjectiveRequirementUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.analysisCaseDefinition`.
     * @param ctx the parse tree
     */
    enterAnalysisCaseDefinition?: (ctx: AnalysisCaseDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.analysisCaseDefinition`.
     * @param ctx the parse tree
     */
    exitAnalysisCaseDefinition?: (ctx: AnalysisCaseDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.analysisCaseUsage`.
     * @param ctx the parse tree
     */
    enterAnalysisCaseUsage?: (ctx: AnalysisCaseUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.analysisCaseUsage`.
     * @param ctx the parse tree
     */
    exitAnalysisCaseUsage?: (ctx: AnalysisCaseUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.verificationCaseDefinition`.
     * @param ctx the parse tree
     */
    enterVerificationCaseDefinition?: (ctx: VerificationCaseDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.verificationCaseDefinition`.
     * @param ctx the parse tree
     */
    exitVerificationCaseDefinition?: (ctx: VerificationCaseDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.verificationCaseUsage`.
     * @param ctx the parse tree
     */
    enterVerificationCaseUsage?: (ctx: VerificationCaseUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.verificationCaseUsage`.
     * @param ctx the parse tree
     */
    exitVerificationCaseUsage?: (ctx: VerificationCaseUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementVerificationMember`.
     * @param ctx the parse tree
     */
    enterRequirementVerificationMember?: (ctx: RequirementVerificationMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementVerificationMember`.
     * @param ctx the parse tree
     */
    exitRequirementVerificationMember?: (ctx: RequirementVerificationMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.requirementVerificationUsage`.
     * @param ctx the parse tree
     */
    enterRequirementVerificationUsage?: (ctx: RequirementVerificationUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.requirementVerificationUsage`.
     * @param ctx the parse tree
     */
    exitRequirementVerificationUsage?: (ctx: RequirementVerificationUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.useCaseDefinition`.
     * @param ctx the parse tree
     */
    enterUseCaseDefinition?: (ctx: UseCaseDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.useCaseDefinition`.
     * @param ctx the parse tree
     */
    exitUseCaseDefinition?: (ctx: UseCaseDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.useCaseUsage`.
     * @param ctx the parse tree
     */
    enterUseCaseUsage?: (ctx: UseCaseUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.useCaseUsage`.
     * @param ctx the parse tree
     */
    exitUseCaseUsage?: (ctx: UseCaseUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.includeUseCaseUsage`.
     * @param ctx the parse tree
     */
    enterIncludeUseCaseUsage?: (ctx: IncludeUseCaseUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.includeUseCaseUsage`.
     * @param ctx the parse tree
     */
    exitIncludeUseCaseUsage?: (ctx: IncludeUseCaseUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewDefinition`.
     * @param ctx the parse tree
     */
    enterViewDefinition?: (ctx: ViewDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewDefinition`.
     * @param ctx the parse tree
     */
    exitViewDefinition?: (ctx: ViewDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewDefinitionBody`.
     * @param ctx the parse tree
     */
    enterViewDefinitionBody?: (ctx: ViewDefinitionBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewDefinitionBody`.
     * @param ctx the parse tree
     */
    exitViewDefinitionBody?: (ctx: ViewDefinitionBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewDefinitionBodyItem`.
     * @param ctx the parse tree
     */
    enterViewDefinitionBodyItem?: (ctx: ViewDefinitionBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewDefinitionBodyItem`.
     * @param ctx the parse tree
     */
    exitViewDefinitionBodyItem?: (ctx: ViewDefinitionBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewRenderingMember`.
     * @param ctx the parse tree
     */
    enterViewRenderingMember?: (ctx: ViewRenderingMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewRenderingMember`.
     * @param ctx the parse tree
     */
    exitViewRenderingMember?: (ctx: ViewRenderingMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewRenderingUsage`.
     * @param ctx the parse tree
     */
    enterViewRenderingUsage?: (ctx: ViewRenderingUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewRenderingUsage`.
     * @param ctx the parse tree
     */
    exitViewRenderingUsage?: (ctx: ViewRenderingUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewUsage`.
     * @param ctx the parse tree
     */
    enterViewUsage?: (ctx: ViewUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewUsage`.
     * @param ctx the parse tree
     */
    exitViewUsage?: (ctx: ViewUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewBody`.
     * @param ctx the parse tree
     */
    enterViewBody?: (ctx: ViewBodyContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewBody`.
     * @param ctx the parse tree
     */
    exitViewBody?: (ctx: ViewBodyContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewBodyItem`.
     * @param ctx the parse tree
     */
    enterViewBodyItem?: (ctx: ViewBodyItemContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewBodyItem`.
     * @param ctx the parse tree
     */
    exitViewBodyItem?: (ctx: ViewBodyItemContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.expose`.
     * @param ctx the parse tree
     */
    enterExpose?: (ctx: ExposeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.expose`.
     * @param ctx the parse tree
     */
    exitExpose?: (ctx: ExposeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.membershipExpose`.
     * @param ctx the parse tree
     */
    enterMembershipExpose?: (ctx: MembershipExposeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.membershipExpose`.
     * @param ctx the parse tree
     */
    exitMembershipExpose?: (ctx: MembershipExposeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceExpose`.
     * @param ctx the parse tree
     */
    enterNamespaceExpose?: (ctx: NamespaceExposeContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceExpose`.
     * @param ctx the parse tree
     */
    exitNamespaceExpose?: (ctx: NamespaceExposeContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewpointDefinition`.
     * @param ctx the parse tree
     */
    enterViewpointDefinition?: (ctx: ViewpointDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewpointDefinition`.
     * @param ctx the parse tree
     */
    exitViewpointDefinition?: (ctx: ViewpointDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.viewpointUsage`.
     * @param ctx the parse tree
     */
    enterViewpointUsage?: (ctx: ViewpointUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.viewpointUsage`.
     * @param ctx the parse tree
     */
    exitViewpointUsage?: (ctx: ViewpointUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.renderingDefinition`.
     * @param ctx the parse tree
     */
    enterRenderingDefinition?: (ctx: RenderingDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.renderingDefinition`.
     * @param ctx the parse tree
     */
    exitRenderingDefinition?: (ctx: RenderingDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.renderingUsage`.
     * @param ctx the parse tree
     */
    enterRenderingUsage?: (ctx: RenderingUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.renderingUsage`.
     * @param ctx the parse tree
     */
    exitRenderingUsage?: (ctx: RenderingUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataDefinition`.
     * @param ctx the parse tree
     */
    enterMetadataDefinition?: (ctx: MetadataDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataDefinition`.
     * @param ctx the parse tree
     */
    exitMetadataDefinition?: (ctx: MetadataDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.prefixMetadataUsage`.
     * @param ctx the parse tree
     */
    enterPrefixMetadataUsage?: (ctx: PrefixMetadataUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.prefixMetadataUsage`.
     * @param ctx the parse tree
     */
    exitPrefixMetadataUsage?: (ctx: PrefixMetadataUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataBodyUsageMember`.
     * @param ctx the parse tree
     */
    enterMetadataBodyUsageMember?: (ctx: MetadataBodyUsageMemberContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataBodyUsageMember`.
     * @param ctx the parse tree
     */
    exitMetadataBodyUsageMember?: (ctx: MetadataBodyUsageMemberContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.metadataBodyUsage`.
     * @param ctx the parse tree
     */
    enterMetadataBodyUsage?: (ctx: MetadataBodyUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.metadataBodyUsage`.
     * @param ctx the parse tree
     */
    exitMetadataBodyUsage?: (ctx: MetadataBodyUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.extendedDefinition`.
     * @param ctx the parse tree
     */
    enterExtendedDefinition?: (ctx: ExtendedDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.extendedDefinition`.
     * @param ctx the parse tree
     */
    exitExtendedDefinition?: (ctx: ExtendedDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.extendedUsage`.
     * @param ctx the parse tree
     */
    enterExtendedUsage?: (ctx: ExtendedUsageContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.extendedUsage`.
     * @param ctx the parse tree
     */
    exitExtendedUsage?: (ctx: ExtendedUsageContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.filterPackageImportDeclaration`.
     * @param ctx the parse tree
     */
    enterFilterPackageImportDeclaration?: (ctx: FilterPackageImportDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.filterPackageImportDeclaration`.
     * @param ctx the parse tree
     */
    exitFilterPackageImportDeclaration?: (ctx: FilterPackageImportDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.namespaceImportDirect`.
     * @param ctx the parse tree
     */
    enterNamespaceImportDirect?: (ctx: NamespaceImportDirectContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.namespaceImportDirect`.
     * @param ctx the parse tree
     */
    exitNamespaceImportDirect?: (ctx: NamespaceImportDirectContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.calculationUsageDeclaration`.
     * @param ctx the parse tree
     */
    enterCalculationUsageDeclaration?: (ctx: CalculationUsageDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.calculationUsageDeclaration`.
     * @param ctx the parse tree
     */
    exitCalculationUsageDeclaration?: (ctx: CalculationUsageDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.emptyActionUsage_`.
     * @param ctx the parse tree
     */
    enterEmptyActionUsage_?: (ctx: EmptyActionUsage_Context) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.emptyActionUsage_`.
     * @param ctx the parse tree
     */
    exitEmptyActionUsage_?: (ctx: EmptyActionUsage_Context) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.emptyFeature_`.
     * @param ctx the parse tree
     */
    enterEmptyFeature_?: (ctx: EmptyFeature_Context) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.emptyFeature_`.
     * @param ctx the parse tree
     */
    exitEmptyFeature_?: (ctx: EmptyFeature_Context) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.emptyMultiplicity_`.
     * @param ctx the parse tree
     */
    enterEmptyMultiplicity_?: (ctx: EmptyMultiplicity_Context) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.emptyMultiplicity_`.
     * @param ctx the parse tree
     */
    exitEmptyMultiplicity_?: (ctx: EmptyMultiplicity_Context) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.emptyUsage_`.
     * @param ctx the parse tree
     */
    enterEmptyUsage_?: (ctx: EmptyUsage_Context) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.emptyUsage_`.
     * @param ctx the parse tree
     */
    exitEmptyUsage_?: (ctx: EmptyUsage_Context) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.filterPackageImport`.
     * @param ctx the parse tree
     */
    enterFilterPackageImport?: (ctx: FilterPackageImportContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.filterPackageImport`.
     * @param ctx the parse tree
     */
    exitFilterPackageImport?: (ctx: FilterPackageImportContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.nonFeatureChainPrimaryExpression`.
     * @param ctx the parse tree
     */
    enterNonFeatureChainPrimaryExpression?: (ctx: NonFeatureChainPrimaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.nonFeatureChainPrimaryExpression`.
     * @param ctx the parse tree
     */
    exitNonFeatureChainPrimaryExpression?: (ctx: NonFeatureChainPrimaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `SysMLv2Parser.portConjugation`.
     * @param ctx the parse tree
     */
    enterPortConjugation?: (ctx: PortConjugationContext) => void;
    /**
     * Exit a parse tree produced by `SysMLv2Parser.portConjugation`.
     * @param ctx the parse tree
     */
    exitPortConjugation?: (ctx: PortConjugationContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

